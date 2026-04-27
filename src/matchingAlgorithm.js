// PI Connect Matching Algorithm v3
// Two-tier model: Standard and Premium
// Proximity is the primary factor — PIs outside their self-set radius are filtered out
// Premium PIs shown in dedicated section above Standard PIs
// Within each section: sorted by merit score (proximity → rating → experience → availability)

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

const geocodeCache = {}

export async function geocodeLocation(cityState) {
  if (!cityState || cityState === 'United States') return null
  const key = cityState.toLowerCase().trim()
  if (geocodeCache[key]) return geocodeCache[key]
  try {
    const parts = cityState.split(',').map(s => s.trim())
    const query = parts[1] ? `${parts[0]}, ${parts[1]}, USA` : `${parts[0]}, USA`
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`
    const response = await fetch(url, { headers: { 'User-Agent': 'PIConnect/1.0 (piconnect.co)' } })
    if (!response.ok) throw new Error('Geocode failed')
    const data = await response.json()
    if (data?.length > 0) {
      const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
      geocodeCache[key] = coords
      return coords
    }
  } catch (err) { console.warn('Geocode error:', cityState, err) }
  return null
}

// Proximity: 0-40 points (primary factor)
function proximityScore(distance) {
  if (distance === null) return { points: 20, label: 'Location unknown' }
  if (distance < 10)  return { points: 40, label: 'Local (<10 mi)' }
  if (distance < 25)  return { points: 38, label: `${Math.round(distance)} mi away` }
  if (distance < 50)  return { points: 34, label: `${Math.round(distance)} mi away` }
  if (distance < 100) return { points: 28, label: `${Math.round(distance)} mi away` }
  if (distance < 200) return { points: 20, label: `${Math.round(distance)} mi away` }
  if (distance < 350) return { points: 12, label: `${Math.round(distance)} mi away` }
  return { points: 5, label: `${Math.round(distance)} mi away` }
}

// Rating: 0-30 points (confidence-weighted)
function ratingScore(rating, reviewCount) {
  if (reviewCount === 0) return { points: 15, label: 'No reviews yet' }
  const confidence = Math.min(reviewCount / 10, 1)
  const raw = (rating / 5) * 30
  const weighted = 15 + (raw - 15) * confidence
  return { points: Math.round(weighted), label: `${rating.toFixed(1)}⭐ (${reviewCount} review${reviewCount !== 1 ? 's' : ''})` }
}

// Experience: 0-20 points
function experienceScore(yrs) {
  const y = yrs || 0
  if (y >= 15) return { points: 20, label: `${y} years` }
  if (y >= 10) return { points: 17, label: `${y} years` }
  if (y >= 5)  return { points: 13, label: `${y} years` }
  if (y >= 2)  return { points: 8,  label: `${y} years` }
  if (y >= 1)  return { points: 4,  label: `${y} year` }
  return { points: 2, label: 'Not listed' }
}

// Availability: 0-10 points
function availabilityScore(rt) {
  const r = rt || ''
  if (r.includes('1 hour') || r.includes('immediately')) return { points: 10, label: r }
  if (r.includes('2-4'))   return { points: 8, label: r }
  if (r.includes('same'))  return { points: 7, label: r }
  if (r.includes('24'))    return { points: 5, label: r }
  if (r.includes('2-3 days')) return { points: 3, label: r }
  return { points: 2, label: r || 'Not specified' }
}

export function isPremium(membershipTier) {
  return membershipTier === 'premium' || membershipTier === 'featured'
}

export function calculateMatchScore(pi, job, searchCoords = null) {
  const hasLocation = searchCoords !== null
  let distance = null

  if (hasLocation) {
    const loc = pi.location || (pi.city && pi.state ? `${pi.city}, ${pi.state}` : null)
    const piCoords = loc ? geocodeCache[loc.toLowerCase().trim()] : null
    if (piCoords) distance = calculateDistance(searchCoords.lat, searchCoords.lon, piCoords.lat, piCoords.lon)
  }

  const prox  = hasLocation ? proximityScore(distance) : { points: 20, label: 'No location filter' }
  const rat   = ratingScore(pi.rating || 0, pi.review_count || 0)
  const exp   = experienceScore(pi.years_experience)
  const avail = availabilityScore(pi.response_time)
  const total = prox.points + rat.points + exp.points + avail.points

  return {
    score: total,
    factors: [
      { name: 'Proximity',    score: Math.round((prox.points / 40)  * 100), detail: prox.label,  weight: 40 },
      { name: 'Rating',       score: Math.round((rat.points  / 30)  * 100), detail: rat.label,   weight: 30 },
      { name: 'Experience',   score: Math.round((exp.points  / 20)  * 100), detail: exp.label,   weight: 20 },
      { name: 'Availability', score: Math.round((avail.points / 10) * 100), detail: avail.label, weight: 10 },
    ],
    distance: distance !== null ? Math.round(distance) : null,
    recommendation: getRecommendation(total),
    hasLocation
  }
}

function getRecommendation(score) {
  if (score >= 85) return 'Excellent Match'
  if (score >= 70) return 'Great Match'
  if (score >= 55) return 'Good Match'
  if (score >= 40) return 'Fair Match'
  return 'Below Threshold'
}

export function getMatchColor(score) {
  if (score >= 85) return '#10b981'
  if (score >= 70) return '#3b82f6'
  if (score >= 55) return '#f59e0b'
  if (score >= 40) return '#f97316'
  return '#ef4444'
}

function isWithinRadius(pi, searchCoords) {
  if (!searchCoords) return true
  const loc = pi.location || (pi.city && pi.state ? `${pi.city}, ${pi.state}` : null)
  if (!loc) return true
  const piCoords = geocodeCache[loc.toLowerCase().trim()]
  if (!piCoords) return true // include optimistically if not yet geocoded
  const distance = calculateDistance(searchCoords.lat, searchCoords.lon, piCoords.lat, piCoords.lon)
  return distance <= (pi.notification_radius_miles || 100)
}

export async function scoreAndSortPIs(pis, searchCity, searchState, specialties = []) {
  // Only geocode if a city is provided — state-only searches skip location scoring
  // A state-only search returns all PIs in that state sorted by rating/experience
  const hasCity = !!searchCity
  const hasLocation = hasCity
  let searchCoords = null

  if (hasCity) {
    const locationStr = [searchCity, searchState].filter(Boolean).join(', ')
    searchCoords = await geocodeLocation(locationStr)
  }

  if (hasLocation) {
    await Promise.all(pis.map(pi => {
      const loc = pi.location || (pi.city && pi.state ? `${pi.city}, ${pi.state}` : null)
      return loc ? geocodeLocation(loc) : Promise.resolve(null)
    }))
  }

  const mockJob = { investigation_type: specialties[0] || '', budget_min: 500, budget_max: 2000 }

  const scored = pis
    .filter(pi => isWithinRadius(pi, searchCoords))
    .map(pi => ({
      ...pi,
      matchData: {
        ...calculateMatchScore(pi, mockJob, searchCoords),
        membershipBadge: getMembershipBadge(pi.membership_tier)
      }
    }))
    .sort((a, b) => b.matchData.score - a.matchData.score)

  return {
    premium:  scored.filter(pi => isPremium(pi.membership_tier)),
    standard: scored.filter(pi => !isPremium(pi.membership_tier)),
    all: scored
  }
}

export function getMembershipBadge(membershipTier) {
  if (isPremium(membershipTier)) return { label: 'Premium', color: '#667eea', icon: '💎' }
  return null
}

// Legacy exports
export function sortByMatch(pis, job) {
  return pis.map(pi => ({ ...pi, matchData: calculateMatchScore(pi, job, null) }))
    .sort((a, b) => b.matchData.score - a.matchData.score)
}
export function getRecommendedJobs(jobs, pi, minScore = 55) {
  return jobs.map(job => ({ ...job, matchData: calculateMatchScore(pi, job, null) }))
    .filter(j => j.matchData.score >= minScore)
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
export function applyMembershipBoost(baseScore) { return baseScore } // no boost in v3
