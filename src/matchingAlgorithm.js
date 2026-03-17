// PI Connect Matching Algorithm v2
// Uses Nominatim (OpenStreetMap) for free geocoding — no API key required

// ── Haversine distance (miles) ────────────────────────────────────────────────
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// ── Geocoding cache (session-level, avoids repeat API calls) ──────────────────
const geocodeCache = {}

// Geocode using Nominatim (OpenStreetMap) — free, no API key
export async function geocodeLocation(cityState) {
  if (!cityState || cityState === 'United States') return null

  const key = cityState.toLowerCase().trim()
  if (geocodeCache[key]) return geocodeCache[key]

  try {
    // Parse "City, ST" format
    const parts = cityState.split(',').map(s => s.trim())
    const city = parts[0]
    const state = parts[1] || ''

    const query = state
      ? `${city}, ${state}, USA`
      : `${city}, USA`

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`

    const response = await fetch(url, {
      headers: { 'User-Agent': 'PIConnect/1.0 (piconnect.co)' }
    })

    if (!response.ok) throw new Error('Geocode failed')

    const data = await response.json()

    if (data && data.length > 0) {
      const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
      geocodeCache[key] = coords
      return coords
    }
  } catch (err) {
    console.warn('Geocode error for', cityState, err)
  }

  return null
}

// ── Geography score based on distance ────────────────────────────────────────
function geoScore(distance) {
  if (distance < 25)  return { score: 100, label: 'Local' }
  if (distance < 50)  return { score: 90,  label: `${Math.round(distance)} mi away` }
  if (distance < 100) return { score: 75,  label: `${Math.round(distance)} mi away` }
  if (distance < 200) return { score: 55,  label: `${Math.round(distance)} mi away` }
  if (distance < 400) return { score: 35,  label: `${Math.round(distance)} mi away` }
  if (distance < 700) return { score: 15,  label: `${Math.round(distance)} mi away` }
  return { score: 5, label: `${Math.round(distance)} mi away` }
}

// ── Main match score calculation ──────────────────────────────────────────────
// Pass searchCoords: { lat, lon } | null when no location search
export function calculateMatchScore(pi, job, searchCoords = null) {
  const hasLocation = searchCoords !== null

  // Weights shift when no location is provided
  const weights = hasLocation
    ? { geography: 0.30, specialty: 0.30, experience: 0.15, rating: 0.15, price: 0.05, availability: 0.05 }
    : { geography: 0,    specialty: 0.40, experience: 0.20, rating: 0.25, price: 0.10, availability: 0.05 }

  let score = 0
  const factors = []
  let distance = null

  // 1. GEOGRAPHY
  if (hasLocation) {
    const piLocation = pi.location || `${pi.city}, ${pi.state}`
    const piCoordsFromCache = geocodeCache[piLocation?.toLowerCase().trim()]

    if (piCoordsFromCache) {
      distance = calculateDistance(searchCoords.lat, searchCoords.lon, piCoordsFromCache.lat, piCoordsFromCache.lon)
      const geo = geoScore(distance)
      score += (geo.score / 100) * weights.geography
      factors.push({ name: 'Location', score: geo.score, detail: geo.label })
    } else {
      // Coords not cached yet — give neutral score, will improve after geocoding
      score += 0.5 * weights.geography
      factors.push({ name: 'Location', score: 50, detail: 'Location pending' })
    }
  }

  // 2. SPECIALTY
  const jobType = job.investigation_type || job.case_type || ''
  const piSpecialties = pi.specialties || []
  let specialtyScore = 0

  if (jobType && piSpecialties.includes(jobType)) {
    specialtyScore = 100
    factors.push({ name: 'Specialty', score: 100, detail: 'Specializes in this type' })
  } else if (jobType && piSpecialties.some(s => s.toLowerCase().includes(jobType.toLowerCase().split(' ')[0]))) {
    specialtyScore = 70
    factors.push({ name: 'Specialty', score: 70, detail: 'Related specialty' })
  } else if (piSpecialties.length > 0) {
    specialtyScore = 40
    factors.push({ name: 'Specialty', score: 40, detail: 'General investigator' })
  } else {
    specialtyScore = 20
    factors.push({ name: 'Specialty', score: 20, detail: 'No specialties listed' })
  }
  score += (specialtyScore / 100) * weights.specialty

  // 3. EXPERIENCE
  const yearsExp = pi.years_experience || 0
  let expScore = yearsExp >= 15 ? 100 : yearsExp >= 10 ? 90 : yearsExp >= 5 ? 75 : yearsExp >= 2 ? 50 : 30
  score += (expScore / 100) * weights.experience
  factors.push({ name: 'Experience', score: expScore, detail: yearsExp > 0 ? `${yearsExp} yrs` : 'Not listed' })

  // 4. RATING
  const rating = pi.rating || 0
  const reviewCount = pi.review_count || 0
  let ratingScore = reviewCount === 0 ? 50 : (rating / 5) * 100
  score += (ratingScore / 100) * weights.rating
  factors.push({
    name: 'Rating',
    score: Math.round(ratingScore),
    detail: reviewCount === 0 ? 'No reviews yet' : `${rating.toFixed(1)}⭐ (${reviewCount})`
  })

  // 5. PRICE
  const piRate = pi.hourly_rate || 100
  const jobBudgetMax = job.budget_max || 2000
  let priceScore = piRate * 20 <= jobBudgetMax ? 100 : piRate * 10 <= jobBudgetMax ? 70 : piRate * 5 <= jobBudgetMax ? 40 : 20
  score += (priceScore / 100) * weights.price
  factors.push({ name: 'Rate', score: priceScore, detail: pi.hourly_rate ? `$${piRate}/hr` : 'Rate not listed' })

  // 6. AVAILABILITY
  const responseTime = pi.response_time || ''
  let availScore = responseTime.includes('1 hour') ? 100 : responseTime.includes('2-4') ? 90 : responseTime.includes('24') ? 70 : responseTime.includes('2-3') ? 50 : 40
  score += (availScore / 100) * weights.availability
  factors.push({ name: 'Availability', score: availScore, detail: responseTime || 'Not specified' })

  const finalScore = Math.round(score * 100)

  return {
    score: finalScore,
    factors,
    distance: distance !== null ? Math.round(distance) : null,
    recommendation: getRecommendation(finalScore),
    hasLocation
  }
}

function getRecommendation(score) {
  if (score >= 90) return 'Excellent Match'
  if (score >= 75) return 'Great Match'
  if (score >= 60) return 'Good Match'
  if (score >= 40) return 'Fair Match'
  return 'Below Threshold'
}

export function getMatchColor(score) {
  if (score >= 90) return '#10b981'
  if (score >= 75) return '#3b82f6'
  if (score >= 60) return '#f59e0b'
  if (score >= 40) return '#f97316'
  return '#ef4444'
}

// ── Async version: geocodes all PI locations before scoring ───────────────────
export async function scoreAndSortPIs(pis, searchCity, searchState, specialties = []) {
  const hasLocation = !!(searchCity || searchState)

  // Geocode the search location
  let searchCoords = null
  if (hasLocation) {
    const locationStr = searchCity && searchState
      ? `${searchCity}, ${searchState}`
      : searchState
        ? searchState
        : searchCity
    searchCoords = await geocodeLocation(locationStr)
  }

  // Geocode all PI locations concurrently
  if (hasLocation) {
    await Promise.all(pis.map(pi => {
      const loc = pi.location || (pi.city && pi.state ? `${pi.city}, ${pi.state}` : null)
      if (loc) return geocodeLocation(loc)
      return Promise.resolve(null)
    }))
  }

  // Build mock job for scoring
  const mockJob = {
    location: searchCity && searchState ? `${searchCity}, ${searchState}` : '',
    investigation_type: specialties[0] || '',
    budget_min: 500,
    budget_max: 2000
  }

  // Score and sort
  const scored = pis.map(pi => {
    const matchData = calculateMatchScore(pi, mockJob, searchCoords)
    const boostedScore = applyMembershipBoost(matchData.score, pi.membership_tier)
    return {
      ...pi,
      matchData: {
        ...matchData,
        score: boostedScore,
        baseScore: matchData.score,
        membershipBadge: getMembershipBadge(pi.membership_tier)
      }
    }
  })

  // If location search: show all results sorted by distance/score
  // If no location: sort by score, hide very low matches
  if (hasLocation) {
    return scored.sort((a, b) => b.matchData.score - a.matchData.score)
  } else {
    return scored
      .filter(pi => pi.matchData.score >= 30)
      .sort((a, b) => b.matchData.score - a.matchData.score)
  }
}

// Legacy sync exports (for backward compatibility with RecommendedJobsSection etc.)
export function sortByMatch(pis, job) {
  return pis.map(pi => ({
    ...pi,
    matchData: calculateMatchScore(pi, job, null)
  })).sort((a, b) => b.matchData.score - a.matchData.score)
}

export function getRecommendedJobs(jobs, pi, minScore = 60) {
  return jobs.map(job => ({
    ...job,
    matchData: calculateMatchScore(pi, job, null)
  }))
  .filter(job => job.matchData.score >= minScore)
  .sort((a, b) => b.matchData.score - a.matchData.score)
}

export function filterByMatchThreshold(pis, job, minScore = 40) {
  return sortByMatch(pis, job).filter(pi => pi.matchData.score >= minScore)
}

export function getTopMatches(pis, job, count = 5) {
  return sortByMatch(pis, job).slice(0, count)
}

export function calculateJobMatchForPI(job, pi) {
  return calculateMatchScore(pi, job, null)
}

// ── Membership tier boost ─────────────────────────────────────────────────────
// Applied after base score calculation
// Tiers: 'standard' (default), 'premium' (+5), 'featured' (+10)
// Boost is additive and capped at 100

export function applyMembershipBoost(baseScore, membershipTier) {
  const boosts = {
    standard: 0,
    premium: 5,
    featured: 10
  }
  const boost = boosts[membershipTier] || 0
  return Math.min(100, baseScore + boost)
}

export function getMembershipBadge(membershipTier) {
  if (membershipTier === 'featured') return { label: 'Featured', color: '#f59e0b', icon: '⭐' }
  if (membershipTier === 'premium') return { label: 'Premium', color: '#667eea', icon: '💎' }
  return null
}
