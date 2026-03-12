// Maps destination keywords to ISO 3166-1 alpha-2 country codes
// Used with flagcdn.com for reliable cross-platform flag images
const flagMap: { keywords: string[]; code: string }[] = [
  { keywords: ["usa", "united states", "new york", "ny", "los angeles", "la", "san francisco", "sf", "chicago", "washington dc", "dc", "boston", "seattle", "portland", "austin", "denver", "nashville", "orlando", "miami", "hawaii", "honolulu", "maui"], code: "us" },
  { keywords: ["canada", "vancouver", "toronto", "montreal"], code: "ca" },
  { keywords: ["mexico", "cancun", "tulum", "mexico city"], code: "mx" },
  { keywords: ["ireland", "dublin"], code: "ie" },
  { keywords: ["uk", "united kingdom", "england", "london", "edinburgh", "scotland"], code: "gb" },
  { keywords: ["france", "paris", "nice", "lyon", "bordeaux"], code: "fr" },
  { keywords: ["spain", "barcelona", "madrid", "seville", "valencia"], code: "es" },
  { keywords: ["italy", "rome", "florence", "venice", "milan", "amalfi", "naples"], code: "it" },
  { keywords: ["germany", "berlin", "munich", "hamburg", "frankfurt"], code: "de" },
  { keywords: ["netherlands", "amsterdam", "rotterdam"], code: "nl" },
  { keywords: ["austria", "vienna", "salzburg"], code: "at" },
  { keywords: ["czech", "prague"], code: "cz" },
  { keywords: ["portugal", "lisbon", "porto"], code: "pt" },
  { keywords: ["denmark", "copenhagen"], code: "dk" },
  { keywords: ["sweden", "stockholm", "gothenburg"], code: "se" },
  { keywords: ["norway", "oslo", "bergen"], code: "no" },
  { keywords: ["switzerland", "zurich", "geneva", "interlaken", "bern"], code: "ch" },
  { keywords: ["iceland", "reykjavik"], code: "is" },
  { keywords: ["greece", "athens", "santorini", "mykonos", "crete"], code: "gr" },
  { keywords: ["croatia", "dubrovnik", "split", "zagreb"], code: "hr" },
  { keywords: ["japan", "tokyo", "kyoto", "osaka", "hakone"], code: "jp" },
  { keywords: ["korea", "seoul", "busan"], code: "kr" },
  { keywords: ["singapore"], code: "sg" },
  { keywords: ["indonesia", "bali", "jakarta"], code: "id" },
  { keywords: ["thailand", "bangkok", "chiang mai", "phuket"], code: "th" },
  { keywords: ["taiwan", "taipei"], code: "tw" },
  { keywords: ["hong kong"], code: "hk" },
  { keywords: ["vietnam", "hanoi", "ho chi minh", "hoi an"], code: "vn" },
  { keywords: ["malaysia", "kuala lumpur", "penang"], code: "my" },
  { keywords: ["china", "beijing", "shanghai", "chengdu"], code: "cn" },
  { keywords: ["india", "mumbai", "delhi", "bangalore", "jaipur"], code: "in" },
  { keywords: ["australia", "sydney", "melbourne", "gold coast", "brisbane"], code: "au" },
  { keywords: ["new zealand", "auckland", "queenstown", "wellington"], code: "nz" },
  { keywords: ["uae", "dubai", "abu dhabi"], code: "ae" },
  { keywords: ["south africa", "cape town", "johannesburg", "durban", "kruger"], code: "za" },
  { keywords: ["morocco", "marrakech", "casablanca", "fez", "agadir", "essaouira"], code: "ma" },
  { keywords: ["kenya", "nairobi", "masai mara", "mara", "amboseli", "mombasa", "diani"], code: "ke" },
  { keywords: ["tanzania", "dar es salaam", "zanzibar", "serengeti", "kilimanjaro", "arusha", "ngorongoro"], code: "tz" },
  { keywords: ["egypt", "cairo", "luxor", "aswan", "hurghada", "sharm el sheikh", "giza"], code: "eg" },
  { keywords: ["rwanda", "kigali", "volcanoes"], code: "rw" },
  { keywords: ["uganda", "kampala", "bwindi"], code: "ug" },
  { keywords: ["namibia", "windhoek", "sossusvlei", "etosha", "swakopmund"], code: "na" },
  { keywords: ["botswana", "gaborone", "okavango", "chobe"], code: "bw" },
  { keywords: ["zimbabwe", "harare", "victoria falls"], code: "zw" },
  { keywords: ["zambia", "lusaka", "livingstone"], code: "zm" },
  { keywords: ["ghana", "accra", "kumasi", "cape coast"], code: "gh" },
  { keywords: ["senegal", "dakar", "saint-louis"], code: "sn" },
  { keywords: ["ethiopia", "addis ababa", "lalibela", "axum"], code: "et" },
  { keywords: ["nigeria", "lagos", "abuja"], code: "ng" },
  { keywords: ["tunisia", "tunis", "sousse", "djerba", "hammamet"], code: "tn" },
  { keywords: ["mauritius", "port louis"], code: "mu" },
  { keywords: ["seychelles", "mahé", "praslin", "la digue"], code: "sc" },
  { keywords: ["costa rica", "san josé", "san jose", "manuel antonio", "arenal"], code: "cr" },
  { keywords: ["argentina", "buenos aires"], code: "ar" },
  { keywords: ["brazil", "rio", "sao paulo", "florianopolis"], code: "br" },
  { keywords: ["peru", "lima", "cusco", "machu picchu"], code: "pe" },
  { keywords: ["colombia", "bogota", "cartagena", "medellin"], code: "co" },
  { keywords: ["chile", "santiago", "patagonia"], code: "cl" },
  { keywords: ["ecuador", "quito", "galapagos"], code: "ec" },
]

/**
 * Returns an ISO country code for a destination string, or null if unknown.
 * Use with getFlagUrl() to get a real flag image.
 */
export function getCountryCode(destination: string): string | null {
  const lower = destination.toLowerCase()
  for (const { keywords, code } of flagMap) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return code
    }
  }
  return null
}

/**
 * Returns a flagcdn.com image URL for a given ISO country code.
 * e.g. "us" -> "https://flagcdn.com/w20/us.png"
 */
export function getFlagUrl(code: string): string {
  return `https://flagcdn.com/w20/${code}.png`
}
