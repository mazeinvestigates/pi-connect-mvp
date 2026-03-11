// AI-Powered PI Matching Algorithm

// Calculate geographic distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Geocode a city/state to coordinates (simplified - in production use Google Maps API)
const CITY_COORDINATES = {
  'Miami, FL': { lat: 25.7617, lon: -80.1918 },
  'Los Angeles, CA': { lat: 34.0522, lon: -118.2437 },
  'Chicago, IL': { lat: 41.8781, lon: -87.6298 },
  'New York, NY': { lat: 40.7128, lon: -74.0060 },
  'Houston, TX': { lat: 29.7604, lon: -95.3698 },
  'Phoenix, AZ': { lat: 33.4484, lon: -112.0740 },
  'Philadelphia, PA': { lat: 39.9526, lon: -75.1652 },
  'San Antonio, TX': { lat: 29.4241, lon: -98.4936 },
  'San Diego, CA': { lat: 32.7157, lon: -117.1611 },
  'Dallas, TX': { lat: 32.7767, lon: -96.7970 },
  'San Jose, CA': { lat: 37.3382, lon: -121.8863 },
  'Austin, TX': { lat: 30.2672, lon: -97.7431 },
  'Jacksonville, FL': { lat: 30.3322, lon: -81.6557 },
  'Fort Worth, TX': { lat: 32.7555, lon: -97.3308 },
  'Columbus, OH': { lat: 39.9612, lon: -82.9988 },
  'Charlotte, NC': { lat: 35.2271, lon: -80.8431 },
  'San Francisco, CA': { lat: 37.7749, lon: -122.4194 },
  'Indianapolis, IN': { lat: 39.7684, lon: -86.1581 },
  'Seattle, WA': { lat: 47.6062, lon: -122.3321 },
  'Denver, CO': { lat: 39.7392, lon: -104.9903 },
  'Boston, MA': { lat: 42.3601, lon: -71.0589 },
  'Portland, OR': { lat: 45.5152, lon: -122.6784 },
  'Las Vegas, NV': { lat: 36.1699, lon: -115.1398 },
  'Detroit, MI': { lat: 42.3314, lon: -83.0458 },
  'Nashville, TN': { lat: 36.1627, lon: -86.7816 },
  'Orlando, FL': { lat: 28.5383, lon: -81.3792 },
  'Tampa, FL': { lat: 27.9506, lon: -82.4572 },
  'Atlanta, GA': { lat: 33.7490, lon: -84.3880 }
}

function getCoordinates(location) {
  // Try to find exact match first
  if (CITY_COORDINATES[location]) {
    return CITY_COORDINATES[location]
  }
  
  // Try partial match (just city name)
  const cityName = location.split(',')[0].trim()
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (key.startsWith(cityName)) {
      return coords
    }
  }
  
  // Default to center of US if no match
  return { lat: 39.8283, lon: -98.5795 }
}

// Calculate match score between a PI and a job/consultation
export function calculateMatchScore(pi, job, options = {}) {
  const weights = {
    geography: 0.25,      // 25% - Location proximity
    specialty: 0.30,      // 30% - Investigation type match
    experience: 0.15,     // 15% - Years of experience
    rating: 0.15,         // 15% - Average rating
    price: 0.10,          // 10% - Price compatibility
    availability: 0.05    // 5% - Response time/availability
  }
  
  let score = 0
  const factors = []
  
  // 1. GEOGRAPHY SCORE
  const piCoords = getCoordinates(pi.location || `${pi.city}, ${pi.state}`)
  const jobCoords = getCoordinates(job.location)
  const distance = calculateDistance(piCoords.lat, piCoords.lon, jobCoords.lat, jobCoords.lon)
  
  let geoScore = 0
  if (distance < 25) geoScore = 100      // Same metro area
  else if (distance < 100) geoScore = 80  // Within 100 miles
  else if (distance < 250) geoScore = 50  // Within 250 miles
  else if (distance < 500) geoScore = 25  // Within 500 miles
  else geoScore = 10                      // Far away
  
  score += (geoScore / 100) * weights.geography
  factors.push({
    name: 'Location',
    score: geoScore,
    detail: distance < 25 ? 'Local' : `${Math.round(distance)} miles away`
  })
  
  // 2. SPECIALTY MATCH SCORE
  const jobType = job.investigation_type || job.case_type
  const piSpecialties = pi.specialties || []
  
  let specialtyScore = 0
  if (piSpecialties.includes(jobType)) {
    specialtyScore = 100 // Perfect match
    factors.push({ name: 'Specialty', score: 100, detail: 'Specializes in this type' })
  } else if (piSpecialties.length > 0) {
    specialtyScore = 40 // Has other specialties
    factors.push({ name: 'Specialty', score: 40, detail: 'Has related experience' })
  } else {
    specialtyScore = 20 // No specialty info
    factors.push({ name: 'Specialty', score: 20, detail: 'General investigator' })
  }
  
  score += (specialtyScore / 100) * weights.specialty
  
  // 3. EXPERIENCE SCORE
  const yearsExp = pi.years_experience || 0
  let expScore = 0
  if (yearsExp >= 15) expScore = 100
  else if (yearsExp >= 10) expScore = 90
  else if (yearsExp >= 5) expScore = 75
  else if (yearsExp >= 2) expScore = 50
  else expScore = 30
  
  score += (expScore / 100) * weights.experience
  factors.push({
    name: 'Experience',
    score: expScore,
    detail: `${yearsExp} years`
  })
  
  // 4. RATING SCORE
  const rating = pi.rating || 0
  const reviewCount = pi.review_count || 0
  let ratingScore = 0
  
  if (reviewCount === 0) {
    ratingScore = 50 // No reviews yet
    factors.push({ name: 'Rating', score: 50, detail: 'No reviews yet' })
  } else {
    ratingScore = (rating / 5) * 100
    factors.push({
      name: 'Rating',
      score: Math.round(ratingScore),
      detail: `${rating.toFixed(1)} ⭐ (${reviewCount} reviews)`
    })
  }
  
  score += (ratingScore / 100) * weights.rating
  
  // 5. PRICE COMPATIBILITY SCORE
  const piRate = pi.hourly_rate || 100
  const jobBudgetMax = job.budget_max || 2000
  const jobBudgetMin = job.budget_min || 500
  const estimatedHours = (jobBudgetMax + jobBudgetMin) / 2 / piRate
  
  let priceScore = 0
  if (piRate * 20 <= jobBudgetMax) { // Assuming 20 hours average
    priceScore = 100 // Definitely affordable
  } else if (piRate * 10 <= jobBudgetMax) {
    priceScore = 70 // Probably affordable
  } else if (piRate * 5 <= jobBudgetMax) {
    priceScore = 40 // Might be tight
  } else {
    priceScore = 20 // Likely too expensive
  }
  
  score += (priceScore / 100) * weights.price
  factors.push({
    name: 'Price',
    score: priceScore,
    detail: `$${piRate}/hr`
  })
  
  // 6. AVAILABILITY SCORE
  const responseTime = pi.response_time || 'Within 24-48 hours'
  let availScore = 0
  
  if (responseTime.includes('1 hour')) availScore = 100
  else if (responseTime.includes('2-4')) availScore = 90
  else if (responseTime.includes('24')) availScore = 70
  else if (responseTime.includes('2-3 days')) availScore = 50
  else availScore = 30
  
  score += (availScore / 100) * weights.availability
  factors.push({
    name: 'Availability',
    score: availScore,
    detail: responseTime
  })
  
  // Convert to percentage (0-100)
  const finalScore = Math.round(score * 100)
  
  return {
    score: finalScore,
    factors,
    distance: Math.round(distance),
    recommendation: getRecommendation(finalScore)
  }
}

function getRecommendation(score) {
  if (score >= 90) return 'Excellent Match'
  if (score >= 75) return 'Great Match'
  if (score >= 60) return 'Good Match'
  if (score >= 40) return 'Fair Match'
  return 'Poor Match'
}

// Get match color for UI
export function getMatchColor(score) {
  if (score >= 90) return '#10b981' // Green
  if (score >= 75) return '#3b82f6' // Blue
  if (score >= 60) return '#f59e0b' // Amber
  if (score >= 40) return '#f97316' // Orange
  return '#ef4444' // Red
}

// Sort PIs by match score
export function sortByMatch(pis, job) {
  return pis.map(pi => ({
    ...pi,
    matchData: calculateMatchScore(pi, job)
  })).sort((a, b) => b.matchData.score - a.matchData.score)
}

// Filter PIs by minimum match threshold
export function filterByMatchThreshold(pis, job, minScore = 40) {
  return sortByMatch(pis, job).filter(pi => pi.matchData.score >= minScore)
}

// Get top N matches
export function getTopMatches(pis, job, count = 5) {
  return sortByMatch(pis, job).slice(0, count)
}

// Calculate reverse match: how well does this job match a PI's profile
export function calculateJobMatchForPI(job, pi) {
  // Same algorithm, just reversed perspective
  return calculateMatchScore(pi, job)
}

// Get recommended jobs for a specific PI
export function getRecommendedJobs(jobs, pi, minScore = 60) {
  return jobs.map(job => ({
    ...job,
    matchData: calculateMatchScore(pi, job)
  }))
  .filter(job => job.matchData.score >= minScore)
  .sort((a, b) => b.matchData.score - a.matchData.score)
}
