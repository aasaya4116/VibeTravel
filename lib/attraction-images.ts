// Curated, kid-friendly Unsplash images mapped by attraction category.
// These are verified, safe, family-appropriate photos.

const categoryImages: Record<string, string[]> = {
  Museum: [
    "https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?w=600&h=400&fit=crop", // museum interior
    "https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=600&h=400&fit=crop", // art gallery
    "https://images.unsplash.com/photo-1564399579883-451a5d44ec08?w=600&h=400&fit=crop", // science museum
  ],
  Nature: [
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&h=400&fit=crop", // forest path
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&h=400&fit=crop", // nature valley
    "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&h=400&fit=crop", // aerial nature
  ],
  "Creative Play": [
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&h=400&fit=crop", // colorful art supplies
    "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=600&h=400&fit=crop", // painting
    "https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=600&h=400&fit=crop", // kids crafts
  ],
  Playground: [
    "https://images.unsplash.com/photo-1596997000103-e597b3ca50df?w=600&h=400&fit=crop", // playground
    "https://images.unsplash.com/photo-1564429238961-bf8bb6ea8ea0?w=600&h=400&fit=crop", // colorful play area
    "https://images.unsplash.com/photo-1560807707-8cc77767d783?w=600&h=400&fit=crop", // park swings
  ],
  Cultural: [
    "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=600&h=400&fit=crop", // cultural landmark
    "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=600&h=400&fit=crop", // architecture
    "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=600&h=400&fit=crop", // temple/historic
  ],
  Adventure: [
    "https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&h=400&fit=crop", // hiking
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&h=400&fit=crop", // camping
    "https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=600&h=400&fit=crop", // travel adventure
  ],
  Restaurant: [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=400&fit=crop", // restaurant interior
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=400&fit=crop", // cafe
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop", // food plating
  ],
  Aquarium: [
    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&h=400&fit=crop", // underwater
    "https://images.unsplash.com/photo-1559825481-12a05cc00344?w=600&h=400&fit=crop", // jellyfish
    "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=600&h=400&fit=crop", // aquarium tunnel
  ],
  Zoo: [
    "https://images.unsplash.com/photo-1534567153574-2b12153a87f0?w=600&h=400&fit=crop", // zoo animals
    "https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=600&h=400&fit=crop", // giraffe
    "https://images.unsplash.com/photo-1503918756811-975bd3397178?w=600&h=400&fit=crop", // panda
  ],
  "Theme Park": [
    "https://images.unsplash.com/photo-1575783970733-1aaedde1db74?w=600&h=400&fit=crop", // theme park rides
    "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&h=400&fit=crop", // amusement park
    "https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=600&h=400&fit=crop", // roller coaster
  ],
  Entertainment: [
    "https://images.unsplash.com/photo-1578946956088-940c3b502864?w=600&h=400&fit=crop", // entertainment venue
    "https://images.unsplash.com/photo-1511882150382-421056c89033?w=600&h=400&fit=crop", // arcade games
    "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=600&h=400&fit=crop", // gaming
  ],
}

// Fallback images for categories not in the map
const fallbackImages = [
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=400&fit=crop", // beach
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&h=400&fit=crop", // travel
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&h=400&fit=crop", // scenic
]

/**
 * Get a curated, kid-friendly image URL based on the attraction's category.
 * Uses the attraction name as a seed for consistent but varied selection.
 */
export function getAttractionImage(category: string, name: string): string {
  // Simple hash from name for consistent selection
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  const index = Math.abs(hash)

  // Try exact category match first, then partial match
  const images =
    categoryImages[category] ||
    Object.entries(categoryImages).find(([key]) =>
      category.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(category.toLowerCase())
    )?.[1] ||
    fallbackImages

  return images[index % images.length]
}
