/**
 * AayojanAI — Caterer Matching Pipeline
 * 3-stage: Candidate Retrieval → Ranker → Reranker
 */

// ─── Stage 1: Candidate Retrieval ────────────────────────────────────────────
// Filters caterers by hard constraints — only eligible candidates pass through.
export function candidateRetrieval(caterers, filters) {
  const { serviceType, eventType, guestCount, cuisines, maxDistanceKm = 15 } = filters;

  return caterers.filter(c => {
    // Must support the requested service type
    if (serviceType && !(c.serviceTypes || ["full"]).includes(serviceType)) return false;

    // Must be within max distance
    if (c.distanceKm != null && c.distanceKm > maxDistanceKm) return false;

    // Must support the event type (if specified)
    if (eventType && c.specialty) {
      const specs = c.specialty.map(s => s.toLowerCase());
      if (!specs.includes(eventType.toLowerCase())) return false;
    }

    // Must be active
    if (c.active === false) return false;

    // Guest capacity check (if caterer has min/max defined)
    if (guestCount) {
      if (c.maxGuests && guestCount > c.maxGuests) return false;
      if (c.minGuests && guestCount < c.minGuests && serviceType === "full") return false;
    }

    return true;
  });
}

// ─── Stage 2: Ranker ─────────────────────────────────────────────────────────
// Scores each candidate on a 0-100 scale using weighted signals.
const WEIGHTS = {
  distance:     0.20,  // closer is better
  rating:       0.20,  // higher rating = better
  cuisineMatch: 0.20,  // overlap with user's selected menu/cuisine preferences
  priceFit:     0.20,  // how well they fit the budget
  capacityFit:  0.10,  // guest count within their sweet spot
  experience:   0.10,  // years in business + team size
};

function normalizeScore(value, min, max) {
  if (max === min) return 1;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function ranker(candidates, criteria) {
  const { perPlateBudget, guestCount, selectedItems = [], serviceType } = criteria;

  if (candidates.length === 0) return [];

  // Pre-compute max distance for normalization
  const maxDist = Math.max(...candidates.map(c => c.distanceKm || 0), 1);

  const scored = candidates.map(c => {
    const scores = {};

    // Distance score: closer = higher (inverted, normalized)
    scores.distance = 1 - normalizeScore(c.distanceKm || 0, 0, maxDist);

    // Rating score: 0-5 normalized to 0-1
    scores.rating = (c.rating || 3.5) / 5;

    // Cuisine match: overlap between caterer's cuisines and selected menu items
    const catCuisines = (c.cuisineSpecialties || []).map(s => s.toLowerCase());
    const catTags = (c.tags || []).map(s => s.toLowerCase());
    const allCatKeywords = [...catCuisines, ...catTags];
    const menuLower = selectedItems.map(s => s.toLowerCase());
    let cuisineHits = 0;
    for (const item of menuLower) {
      if (allCatKeywords.some(k => item.includes(k) || k.includes(item))) cuisineHits++;
    }
    scores.cuisineMatch = menuLower.length > 0 ? Math.min(1, cuisineHits / Math.max(menuLower.length * 0.3, 1)) : 0.5;

    // Price fit: how well caterer's price range matches user's budget
    const priceMin = c.pricePerPlateMin || 150;
    const priceMax = c.pricePerPlateMax || 1500;
    if (perPlateBudget >= priceMin && perPlateBudget <= priceMax) {
      scores.priceFit = 1.0; // perfect fit
    } else if (perPlateBudget < priceMin) {
      scores.priceFit = Math.max(0, 1 - (priceMin - perPlateBudget) / priceMin);
    } else {
      scores.priceFit = Math.max(0, 1 - (perPlateBudget - priceMax) / priceMax);
    }

    // Capacity fit: guest count within caterer's sweet spot
    const capMin = c.minGuests || (serviceType === "bulk" ? 1 : 30);
    const capMax = c.maxGuests || 500;
    if (guestCount >= capMin && guestCount <= capMax) {
      // Optimal if in the middle 60% of their range
      const mid = (capMin + capMax) / 2;
      const range = capMax - capMin;
      scores.capacityFit = range > 0 ? 1 - 0.3 * Math.abs(guestCount - mid) / (range / 2) : 1;
    } else {
      scores.capacityFit = 0.3;
    }
    scores.capacityFit = Math.max(0, Math.min(1, scores.capacityFit));

    // Experience: years in business + team size
    const years = c.yearsInBusiness || 2;
    const team = c.teamSize || 5;
    scores.experience = Math.min(1, (years / 15) * 0.6 + (team / 30) * 0.4);

    // Weighted total
    const totalScore = Object.entries(WEIGHTS).reduce(
      (sum, [key, weight]) => sum + (scores[key] || 0) * weight, 0
    );

    return {
      ...c,
      _scores: scores,
      _totalScore: Math.round(totalScore * 100) / 100,
      _matchPercent: Math.round(totalScore * 100),
    };
  });

  // Sort by total score descending
  return scored.sort((a, b) => b._totalScore - a._totalScore);
}

// ─── Stage 3: Reranker ───────────────────────────────────────────────────────
// Applies fairness boosts and diversity constraints to the ranked list.
export function reranker(ranked, options = {}) {
  const { topN = 5, boostSmallPlayers = true, ensureDiversity = true } = options;

  if (ranked.length === 0) return [];

  const reranked = ranked.map(c => {
    let boost = 0;

    if (boostSmallPlayers) {
      const totalOrders = c.totalOrders || 0;
      const rating = c.rating || 0;
      const daysSinceJoined = c.registeredAt
        ? Math.floor((Date.now() - new Date(c.registeredAt).getTime()) / 86400000)
        : 365;

      // Boost newer caterers (< 180 days) with decent ratings (>= 3.5 or unrated)
      if (daysSinceJoined < 180 && (rating >= 3.5 || rating === 0)) {
        boost += 0.08; // New player boost
      }

      // Boost caterers with fewer orders (< 20) to give exposure
      if (totalOrders < 20 && (rating >= 3.5 || rating === 0)) {
        boost += 0.06; // Low-order-count boost
      }

      // Slight boost for caterers who haven't had orders recently
      if (totalOrders < 5) {
        boost += 0.04; // Cold start boost
      }
    }

    return {
      ...c,
      _rerankedScore: c._totalScore + boost,
      _boost: boost,
      _boostReasons: [
        boost > 0.07 ? "🌱 New partner boost" : null,
        boost > 0.04 && (c.totalOrders || 0) < 20 ? "📈 Growing business" : null,
      ].filter(Boolean),
    };
  });

  // Sort by reranked score
  reranked.sort((a, b) => b._rerankedScore - a._rerankedScore);

  // Diversity: ensure not all caterers are from the same cuisine
  if (ensureDiversity && reranked.length > topN) {
    const selected = [];
    const cuisineCount = {};

    for (const c of reranked) {
      if (selected.length >= topN) break;

      const mainCuisine = (c.cuisineSpecialties || [])[0] || "general";

      // Allow max 2 caterers from the same primary cuisine
      if ((cuisineCount[mainCuisine] || 0) >= 2) {
        // Skip, but we might add them later if we don't have enough
        continue;
      }

      cuisineCount[mainCuisine] = (cuisineCount[mainCuisine] || 0) + 1;
      selected.push(c);
    }

    // If diversity filter removed too many, fill from remaining
    if (selected.length < topN) {
      for (const c of reranked) {
        if (selected.length >= topN) break;
        if (!selected.find(s => s.id === c.id)) {
          selected.push(c);
        }
      }
    }

    return selected;
  }

  return reranked.slice(0, topN);
}

// ─── Full Pipeline ───────────────────────────────────────────────────────────
export function matchCaterers(caterers, params) {
  const {
    serviceType, eventType, guestCount, perPlateBudget,
    selectedItems, maxDistanceKm = 15, topN = 5,
  } = params;

  // Stage 1: Candidate Retrieval
  const candidates = candidateRetrieval(caterers, {
    serviceType, eventType, guestCount, maxDistanceKm,
  });

  // Stage 2: Ranker
  const ranked = ranker(candidates, {
    perPlateBudget, guestCount, selectedItems, serviceType,
  });

  // Stage 3: Reranker
  const final = reranker(ranked, { topN, boostSmallPlayers: true, ensureDiversity: true });

  return {
    candidates: candidates.length,
    ranked: ranked.length,
    results: final,
    pipeline: {
      totalCaterers: caterers.length,
      afterRetrieval: candidates.length,
      afterRanking: ranked.length,
      finalCount: final.length,
    },
  };
}

// ─── Anonymous Display Helpers ───────────────────────────────────────────────
const ANON_LABELS = ["Caterer A", "Caterer B", "Caterer C", "Caterer D", "Caterer E",
  "Caterer F", "Caterer G", "Caterer H", "Caterer I", "Caterer J"];
const ANON_ICONS = ["🍽️", "🥘", "🫕", "🥗", "🍛", "🥞", "🎂", "🍲", "🧆", "🍜"];

export function anonymize(caterers) {
  return caterers.map((c, i) => ({
    ...c,
    _anonLabel: ANON_LABELS[i] || `Caterer ${String.fromCharCode(65 + i)}`,
    _anonIcon: ANON_ICONS[i] || "🍽️",
    _realName: c.name,
    _realPhone: c.phone,
    _realOwner: c.ownerName,
  }));
}
