"use client"

import { useEffect, useState } from "react"
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Share2,
  ShieldCheck,
  Unlink,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { buildShareUrl } from "@/lib/trip-sharing"

interface ShareState {
  active: boolean
  token?: string
  createdAt?: string
}

interface TripShareDialogProps {
  tripId: string
  tripTitle: string
  destination: string
}

export function TripShareDialog({ tripId, tripTitle, destination }: TripShareDialogProps) {
  const [open, setOpen] = useState(false)
  const [share, setShare] = useState<ShareState | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const shareUrl =
    share?.active && share.token && typeof window !== "undefined"
      ? buildShareUrl(window.location.origin, share.token)
      : ""

  useEffect(() => {
    if (!open || share) return

    let cancelled = false
    async function loadShare() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/trips/${tripId}/share`, { cache: "no-store" })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || "Could not check sharing status")
        if (!cancelled) setShare(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not check sharing status")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadShare()
    return () => {
      cancelled = true
    }
  }, [open, retryCount, share, tripId])

  async function createLink() {
    setCreating(true)
    setError(null)
    try {
      const response = await fetch(`/api/trips/${tripId}/share`, { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not create the share link")
      setShare(data)
      toast.success("Private trip link created")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the share link")
    } finally {
      setCreating(false)
    }
  }

  async function copyLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success("Link copied")
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("Could not copy the link")
    }
  }

  async function shareLink() {
    if (!shareUrl) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: tripTitle,
          text: `Take a look at our ${destination} trip plan on VibeTravel.`,
          url: shareUrl,
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        await copyLink()
      }
      return
    }
    await copyLink()
  }

  async function revokeLink() {
    if (!confirmRevoke) {
      setConfirmRevoke(true)
      return
    }

    setRevoking(true)
    setError(null)
    try {
      const response = await fetch(`/api/trips/${tripId}/share`, { method: "DELETE" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not stop sharing")
      setShare({ active: false })
      setConfirmRevoke(false)
      toast.success("Sharing stopped")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stop sharing")
    } finally {
      setRevoking(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setConfirmRevoke(false)
      setCopied(false)
    }
  }

  function retry() {
    setShare(null)
    setError(null)
    setRetryCount((count) => count + 1)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl bg-background/90 shadow-sm">
          <Share2 className="h-4 w-4" />
          Share trip
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl border-border p-0">
        <div className="border-b border-border bg-gradient-to-br from-primary/10 via-background to-accent/10 px-6 py-6 pr-12">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Share2 className="h-5 w-5" />
            </div>
            <DialogTitle className="font-serif text-2xl font-normal">Share this trip</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Send family a private, view-only version of your {destination} plan.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6">
          {loading ? (
            <div className="flex min-h-44 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking sharing status…
            </div>
          ) : error ? (
            <div className="py-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={retry}>
                Try again
              </Button>
            </div>
          ) : share?.active && shareUrl ? (
            <div className="space-y-5 pt-6">
              <div className="flex items-center gap-2 text-sm font-medium text-accent">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Private link is active
              </div>

              <div>
                <label htmlFor="trip-share-link" className="mb-2 block text-xs font-medium text-muted-foreground">
                  Anyone with this link can view the trip
                </label>
                <div className="flex rounded-xl border border-border bg-muted/50 p-1">
                  <input
                    id="trip-share-link"
                    readOnly
                    value={shareUrl}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 bg-transparent px-2 text-xs text-foreground outline-none"
                  />
                  <Button size="sm" className="h-9 rounded-lg px-3" onClick={copyLink}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button className="rounded-xl" onClick={shareLink}>
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
                <Button variant="outline" className="rounded-xl" asChild>
                  <a href={shareUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Preview
                  </a>
                </Button>
              </div>

              <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
                <div className="flex gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Viewers cannot edit your trip or see your profile. Stop sharing anytime to disable this link immediately.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={revokeLink}
                disabled={revoking}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                  confirmRevoke
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "text-muted-foreground hover:bg-muted hover:text-destructive"
                }`}
              >
                {revoking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                {confirmRevoke ? "Confirm: stop sharing" : "Stop sharing this trip"}
              </button>
            </div>
          ) : (
            <div className="py-6">
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Create one private link</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Family can open it without an account. The itinerary is view-only, and you stay in control.
                  </p>
                </div>
              </div>
              <Button className="h-11 w-full rounded-xl" onClick={createLink} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                {creating ? "Creating private link…" : "Create private link"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
