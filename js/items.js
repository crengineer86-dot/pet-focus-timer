/**
 * 반려동물 힐링 포모도로 집중 타이머 - 소품 & 동물 카탈로그 (전체 40종: 4개 카테고리 × 각 10종)
 * - 최대 10개 슬롯 배치 (MAX_PLACED_SLOTS = 10)
 * - 기본 제공 아이템: 아장아장 크로키 강아지(living_room_dog) 1종만 초기 무료 보유
 * - 모든 설명은 15자 이내 감성적인 1줄로 구성
 */
(function (global) {
  const PetFocus = (global.PetFocus = global.PetFocus || {});

  const MAX_PLACED_SLOTS = 10;
  const ABSOLUTE_MAX_SLOTS = 30;
  const MAX_OWNED_PER_ITEM = 3;
  const SLOT_EXPANSION_TIERS = [
    { step: 1, from: 10, to: 12, delta: 2, cost: 150 },
    { step: 2, from: 12, to: 14, delta: 2, cost: 250 },
    { step: 3, from: 14, to: 16, delta: 2, cost: 350 },
    { step: 4, from: 16, to: 18, delta: 2, cost: 450 },
    { step: 5, from: 18, to: 20, delta: 2, cost: 550 },
    { step: 6, from: 20, to: 22, delta: 2, cost: 650 },
    { step: 7, from: 22, to: 24, delta: 2, cost: 750 },
    { step: 8, from: 24, to: 26, delta: 2, cost: 850 },
    { step: 9, from: 26, to: 28, delta: 2, cost: 950 },
    { step: 10, from: 28, to: 30, delta: 2, cost: 1050 }
  ];

  const SHOP_CATEGORIES = [
    { id: "all", label: "전체", icon: "" },
    { id: "pet", label: "동물", icon: "🐾" },
    { id: "pet_goods", label: "펫 용품", icon: "🧸" },
    { id: "furniture", label: "가구·조명", icon: "💡" },
    { id: "decor", label: "식물·데코", icon: "🪴" },
    { id: "window_view", label: "창밖", icon: "🪟" }
  ];

  const IMMERSION_BONUS_TABLE = {
    30: 2,  // 기본 18 + 보너스 2 = 20
    35: 3,  // 기본 21 + 보너스 3 = 24
    40: 4,  // 기본 24 + 보너스 4 = 28
    45: 5,  // 기본 27 + 보너스 5 = 32
    50: 8,  // 기본 30 + 보너스 8 = 38
    55: 11, // 기본 33 + 보너스 11 = 44
    60: 14  // 기본 36 + 보너스 14 = 50
  };

  function calculateRewardBreakdown(minutes, placedItemIds = [], isFirstFocusPending = false) {
    const mins = Math.max(5, Number(minutes) || 25);
    const baseBones = Math.floor(mins / 5) * 3;

    let immersionBonus = 0;
    if (mins < 30) {
      immersionBonus = 0;
    } else if (IMMERSION_BONUS_TABLE[mins] !== undefined) {
      immersionBonus = IMMERSION_BONUS_TABLE[mins];
    } else if (mins > 60) {
      immersionBonus = 14 + Math.floor((mins - 60) / 5) * 3;
    } else {
      const snapped = Math.floor(mins / 5) * 5;
      immersionBonus = IMMERSION_BONUS_TABLE[snapped] || 0;
    }

    const subtotal = baseBones + immersionBonus;
    const boostPercent = getTotalBoostPercent(placedItemIds);
    const boostBones =
      boostPercent > 0 ? Math.max(1, Math.round(subtotal * (boostPercent / 100))) : 0;
    const welcomeBonus = isFirstFocusPending ? 30 : 0;

    return {
      minutes: mins,
      baseBones,
      immersionBonus,
      subtotal,
      boostPercent,
      boostBones,
      welcomeBonus,
      totalWithExtras: subtotal + boostBones + welcomeBonus
    };
  }

  function getTotalBoostPercent(placedItemIds = []) {
    if (!Array.isArray(placedItemIds) || placedItemIds.length === 0) return 0;
    const set = new Set(
      placedItemIds
        .map((entry) => (typeof entry === "string" ? entry : entry?.itemId))
        .filter(Boolean)
    );
    return ITEMS_CATALOG.reduce((sum, item) => {
      return set.has(item.id) ? sum + (Number(item.boostPercent) || 0) : sum;
    }, 0);
  }

  function getMaxOwnedForItem(itemOrId) {
    const item = typeof itemOrId === "string" ? getItemById(itemOrId) : itemOrId;
    if (!item) return 1;
    return item.category === "window_view" ? 1 : MAX_OWNED_PER_ITEM;
  }

  function getPurchasePriceForItem(itemOrId, ownedCount = 0) {
    const item = typeof itemOrId === "string" ? getItemById(itemOrId) : itemOrId;
    if (!item) return 0;
    const basePrice = Number(item.price) || 0;
    if (ownedCount >= 1 && basePrice === 0) {
      return Number(item.duplicatePrice) || 50;
    }
    return basePrice;
  }

  const ITEMS_CATALOG = [
    /* =========================================================================
       [1. 🐾 동물 (pet) — 총 10종]
       ========================================================================= */
    {
      id: "living_room_dog",
      name: "아장아장 크로키 강아지",
      shortName: "크로키 강아지",
      category: "pet",
      categoryLabel: "🐾 동물",
      zoneLabel: "반려동물",
      price: 0,
      boostPercent: 5,
      defaultOwned: true,
      defaultPlaced: false,
      defaultPos: { x: 196, y: 296 },
      badge: "기본 제공",
      description: "함께 집중해 주는 든든한 단짝",
      reactionQuote: "멍! 원하는 곳으로 나를 끌어서 옮길 수도 있어요 🐾",
      cardBg: "#F7EFE2",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(48, 46)">
            <line x1="-12" y1="4" x2="-14" y2="17" stroke="#1F1E1D" stroke-width="1.9" stroke-linecap="round" />
            <line x1="-6" y1="4" x2="-4" y2="17" stroke="#1F1E1D" stroke-width="1.9" stroke-linecap="round" />
            <line x1="10" y1="4" x2="8" y2="17" stroke="#1F1E1D" stroke-width="1.9" stroke-linecap="round" />
            <line x1="16" y1="4" x2="18" y2="17" stroke="#1F1E1D" stroke-width="1.9" stroke-linecap="round" />
            <path d="M-19 -6 C-27 -12, -29 -19, -23 -21" fill="none" stroke="#1F1E1D" stroke-width="1.9" stroke-linecap="round" />
            <path d="M-20 -4 C-21 -14, -8 -16, 8 -14 C18 -13, 22 -5, 20 3 C18 8, -17 8, -20 -4 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.85" stroke-linejoin="round" />
            <g transform="translate(18, -14)">
              <circle cx="2" cy="-2" r="12.5" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.85" />
              <path d="M-5 -10 C-11 -9, -13 1, -7 4 C-3 5, -2 -3, -4 -8" fill="#EAE0D0" stroke="#1F1E1D" stroke-width="1.7" stroke-linejoin="round" />
              <circle cx="7" cy="-4" r="1.7" fill="#1F1E1D" />
              <ellipse cx="14" cy="-1.5" rx="2.5" ry="1.9" fill="#1F1E1D" />
              <path d="M10 2.5 Q12 5 14 2.5" fill="none" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round" />
              <ellipse cx="5" cy="1" rx="2.8" ry="1.6" fill="#F2B8A2" opacity="0.75" />
            </g>
            <path d="M10 -12 C12 -6, 16 -4, 19 -5" fill="none" stroke="#D97736" stroke-width="2" stroke-linecap="round" />
            <circle cx="16" cy="-4" r="2.2" fill="#F4C065" stroke="#1F1E1D" stroke-width="1.1" />
          </g>
        </svg>
      `
    },
    {
      id: "window_cat",
      name: "새근새근 낮잠 고양이",
      shortName: "낮잠 고양이",
      category: "pet",
      categoryLabel: "🐾 동물",
      zoneLabel: "반려동물",
      price: 150,
      boostPercent: 5,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 298, y: 160 },
      badge: "인기",
      description: "창가에서 새근새근 낮잠 자는 친구",
      reactionQuote: "골골골... 따스한 햇살 아래서 낮잠 자는 중 🐱 (부스트 +5%)",
      cardBg: "#F6EFE2",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="12" y1="62" x2="88" y2="62" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round"/>
          <path d="M28 62 C25 46, 38 36, 54 38 C68 39, 75 49, 72 62 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="2" stroke-linejoin="round"/>
          <path d="M31 52 C29 44, 34 37, 42 38 C48 39, 51 45, 49 52" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round"/>
          <path d="M32 41 L30 33 L37 38" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="2" stroke-linejoin="round"/>
          <path d="M42 38 L46 32 L48 40" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="2" stroke-linejoin="round"/>
          <path d="M35 46 Q37 48 39 46" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round"/>
          <path d="M42 46 Q44 48 46 46" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round"/>
          <line x1="26" y1="48" x2="31" y2="48" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round"/>
          <line x1="27" y1="51" x2="31" y2="50" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M70 59 C76 62, 78 69, 73 72 C69 74, 66 70, 68 66" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round" fill="none"/>
          <text x="58" y="30" fill="#D97736" font-size="10" font-weight="700" font-family="sans-serif">z</text>
          <text x="65" y="23" fill="#D97736" font-size="12" font-weight="700" font-family="sans-serif">Z</text>
        </svg>
      `
    },
    {
      id: "tuxedo_cat",
      name: "말랑 치즈 고양이",
      shortName: "치즈 고양이",
      category: "pet",
      categoryLabel: "🐾 동물",
      zoneLabel: "반려동물",
      price: 150,
      boostPercent: 5,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 224, y: 160 },
      badge: "인기",
      description: "살구빛 줄무늬가 귀여운 치즈냥",
      reactionQuote: "골골골... 말랑한 식빵 굽고 있어요 🐱 (부스트 +5%)",
      cardBg: "#FAF1E6",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 60)">
            <path d="M18 -4 C27 -4, 30 -13, 25 -17" fill="none" stroke="#1F1E1D" stroke-width="2.1" stroke-linecap="round"/>
            <rect x="-20" y="-19" width="38" height="19" rx="9" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.8"/>
            <path d="M-2 -18.5 C-1 -12, 2 -12, 3 -18.5 Z" fill="#F4C392"/>
            <path d="M6 -18.5 C7 -11, 10 -11, 11 -18.5 Z" fill="#F4C392"/>
            <path d="M13 -17 C15 -12, 17 -13, 17 -16 Z" fill="#F4C392"/>
            <path d="M-12 0 C-12 -8.5, -3 -10, 2 0 Z" fill="#FFFDF9"/>
            <ellipse cx="-10" cy="-1" rx="4.2" ry="2.2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.5"/>
            <ellipse cx="-1" cy="-1" rx="4.2" ry="2.2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.5"/>
            <g transform="translate(-8, -21)">
              <circle cx="0" cy="0" r="10.4" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.75"/>
              <path d="M-8.8 -5.5 L-10.8 -14.8 L-2.8 -8.8 Z" fill="#F6CCA2" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round"/>
              <path d="M8.8 -5.5 L10.8 -14.8 L2.8 -8.8 Z" fill="#F6CCA2" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round"/>
              <path d="M-5 -8.5 Q0 -3.5 5 -8.5" fill="#F4C392"/>
              <line x1="0" y1="-9.5" x2="0" y2="-5.5" stroke="#D97736" stroke-width="1.4" stroke-linecap="round"/>
              <line x1="-2.6" y1="-9" x2="-1.6" y2="-6" stroke="#D97736" stroke-width="1.3" stroke-linecap="round"/>
              <line x1="2.6" y1="-9" x2="1.6" y2="-6" stroke="#D97736" stroke-width="1.3" stroke-linecap="round"/>
              <circle cx="-3.8" cy="-1.6" r="1.4" fill="#1F1E1D"/>
              <circle cx="3.8" cy="-1.6" r="1.4" fill="#1F1E1D"/>
              <ellipse cx="-5.8" cy="1.2" rx="2" ry="1.1" fill="#F2B8A2" opacity="0.85"/>
              <ellipse cx="5.8" cy="1.2" rx="2" ry="1.1" fill="#F2B8A2" opacity="0.85"/>
              <polygon points="-1.5,0.6 1.5,0.6 0,2.2" fill="#E8845B"/>
              <path d="M-2 2.8 Q0 4.3 2 2.8" fill="none" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round"/>
            </g>
          </g>
        </svg>
      `
    },
    {
      id: "hamster_friend",
      name: "해바라기씨 햄스터",
      shortName: "해바라기 햄스터",
      category: "pet",
      categoryLabel: "🐾 동물",
      zoneLabel: "반려동물",
      price: 120,
      boostPercent: 4,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 105, y: 159 },
      badge: "동물 친구",
      description: "해바라기씨를 오물거리는 햄스터",
      reactionQuote: "오물오물... 볼주머니 가득 응원하는 햄스터 🐹 (부스트 +4%)",
      cardBg: "#F8F1E3",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="20" y1="62" x2="80" y2="62" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round"/>
          <path d="M36 62 C34 46, 40 34, 50 34 C60 34, 66 46, 64 62 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="2" stroke-linejoin="round"/>
          <circle cx="41" cy="36" r="4" fill="#F3E5D0" stroke="#1F1E1D" stroke-width="1.8"/>
          <circle cx="59" cy="36" r="4" fill="#F3E5D0" stroke="#1F1E1D" stroke-width="1.8"/>
          <circle cx="45" cy="44" r="1.6" fill="#1F1E1D"/>
          <circle cx="55" cy="44" r="1.6" fill="#1F1E1D"/>
          <ellipse cx="41" cy="47" rx="2.5" ry="1.5" fill="#F2B8A2" opacity="0.8"/>
          <ellipse cx="59" cy="47" rx="2.5" ry="1.5" fill="#F2B8A2" opacity="0.8"/>
          <path d="M47 51 L50 47 L53 51 Z" fill="#1F1E1D"/>
        </svg>
      `
    },
    {
      id: "cockatiel_bird",
      name: "노래하는 왕관앵무",
      shortName: "왕관앵무",
      category: "pet",
      categoryLabel: "🐾 동물",
      zoneLabel: "반려동물",
      price: 120,
      boostPercent: 4,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 158, y: 90.5 },
      badge: "신규",
      description: "발그레한 볼터치의 귀여운 앵무새",
      reactionQuote: "짹짹! 집중 잘하고 있어? 🦜 (부스트 +4%)",
      cardBg: "#FAF2E3",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="26" y1="62" x2="74" y2="62" stroke="#1F1E1D" stroke-width="1.9" stroke-linecap="round"/>
          <g transform="translate(50, 62)">
            <path d="M2 -6 L7 5 L2 4 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M-9 0 C-12 -11, -9 -22, 0 -22 C8 -22, 11 -11, 7 0 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M-2 -15 C4 -14, 7 -7, 3 -2" fill="none" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="-2" cy="-26" r="8.5" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.8"/>
            <path d="M-3 -34 C-5 -42, -1 -46, 3 -44 M-1 -34 C0 -40, 4 -42, 7 -40" fill="none" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round"/>
            <circle cx="-5" cy="-27" r="1.5" fill="#1F1E1D"/>
            <circle cx="-2" cy="-24" r="2.6" fill="#E8845B" opacity="0.88"/>
            <path d="M-10 -27 L-15 -25 L-10 -23 Z" fill="#F4C065" stroke="#1F1E1D" stroke-width="1.5" stroke-linejoin="round"/>
            <line x1="-3" y1="0" x2="-3" y2="2" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round"/>
            <line x1="3" y1="0" x2="3" y2="2" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round"/>
          </g>
        </svg>
      `
    },
    {
      id: "welsh_corgi",
      name: "총총걸음 웰시코기",
      shortName: "웰시코기",
      category: "pet",
      categoryLabel: "🐾 동물",
      zoneLabel: "반려동물",
      price: 150,
      boostPercent: 5,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 135, y: 350 },
      badge: "인기",
      description: "짧은 다리로 총총 걷는 웰시코기",
      reactionQuote: "멍! 물 한 잔 마실 시간! 🐶 (부스트 +5%)",
      cardBg: "#F9EFE3",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(48, 58)">
            <line x1="-15" y1="-6" x2="-16" y2="0" stroke="#1F1E1D" stroke-width="2.1" stroke-linecap="round"/>
            <line x1="-9" y1="-6" x2="-9" y2="0" stroke="#1F1E1D" stroke-width="2.1" stroke-linecap="round"/>
            <line x1="9" y1="-6" x2="9" y2="0" stroke="#1F1E1D" stroke-width="2.1" stroke-linecap="round"/>
            <line x1="15" y1="-6" x2="16" y2="0" stroke="#1F1E1D" stroke-width="2.1" stroke-linecap="round"/>
            <rect x="-22" y="-19" width="40" height="14" rx="7" fill="#F6E6CE" stroke="#1F1E1D" stroke-width="1.8"/>
            <path d="M-22 -12 C-25 -15, -25 -9, -21 -8" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.6" stroke-linecap="round"/>
            <path d="M-17 -10 C-17 -15, -10 -15, -9 -6 L-20 -6 C-22 -7, -20 -10, -17 -10 Z" fill="#FEF9F1"/>
            <g transform="translate(17, -21)">
              <path d="M-7 -6 L-10 -17 L-1 -10 Z" fill="#F6E6CE" stroke="#1F1E1D" stroke-width="1.7" stroke-linejoin="round"/>
              <path d="M5 -7 L10 -17 L1 -10 Z" fill="#F6E6CE" stroke="#1F1E1D" stroke-width="1.7" stroke-linejoin="round"/>
              <circle cx="0" cy="-2" r="10.5" fill="#F6E6CE" stroke="#1F1E1D" stroke-width="1.8"/>
              <path d="M-2 -8 C3 -8, 8 -3, 8 2 C8 6, -1 7, -3 3 Z" fill="#FEF9F1"/>
              <circle cx="3.5" cy="-3.5" r="1.5" fill="#1F1E1D"/>
              <ellipse cx="10.5" cy="-1.5" rx="2.1" ry="1.5" fill="#1F1E1D"/>
              <ellipse cx="2" cy="1" rx="2.2" ry="1.2" fill="#F2B8A2" opacity="0.8"/>
            </g>
          </g>
        </svg>
      `
    },
    {
      id: "little_turtle",
      name: "느긋한 꼬마 거북이",
      shortName: "꼬마 거북이",
      category: "pet",
      categoryLabel: "🐾 동물",
      zoneLabel: "반려동물",
      price: 90,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 245, y: 392 },
      badge: "힐링",
      description: "느긋한 걸음으로 응원하는 거북이",
      reactionQuote: "천천히 가도 괜찮아 🐢 (부스트 +3%)",
      cardBg: "#EEF3E6",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(48, 56)">
            <ellipse cx="-12" cy="-2" rx="4" ry="2.2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.7"/>
            <ellipse cx="10" cy="-2" rx="4" ry="2.2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.7"/>
            <path d="M-18 -4 L-23 -3 L-18 -6 Z" fill="#1F1E1D"/>
            <path d="M14 -9 C21 -12, 24 -9, 23 -5 C22 -2, 16 -3, 14 -5" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round"/>
            <circle cx="20" cy="-8" r="1.2" fill="#1F1E1D"/>
            <path d="M-18 -4 C-18 -18, 16 -18, 16 -4 Z" fill="#DFECC6" stroke="#1F1E1D" stroke-width="1.85" stroke-linejoin="round"/>
            <path d="M-19 -4 L17 -4" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round"/>
            <path d="M-6 -14 L4 -14 L8 -8 L4 -4 L-6 -4 L-10 -8 Z" fill="none" stroke="#1F1E1D" stroke-width="1.35" stroke-linejoin="round"/>
            <line x1="-6" y1="-14" x2="-9" y2="-16.5" stroke="#1F1E1D" stroke-width="1.3"/>
            <line x1="4" y1="-14" x2="7" y2="-16.5" stroke="#1F1E1D" stroke-width="1.3"/>
          </g>
        </svg>
      `
    },
    {
      id: "hedgehog_friend",
      name: "동글동글 고슴도치",
      shortName: "고슴도치",
      category: "pet",
      categoryLabel: "🐾 동물",
      zoneLabel: "반려동물",
      price: 110,
      boostPercent: 4,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 86, y: 365 },
      badge: "동물 친구",
      description: "아장아장 걷는 동글한 고슴도치",
      reactionQuote: "따끔! 딴짓 금지야 🦔 (부스트 +4%)",
      cardBg: "#F5EFE6",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 56)">
            <line x1="-9" y1="-2" x2="-9" y2="0" stroke="#1F1E1D" stroke-width="1.9" stroke-linecap="round"/>
            <line x1="6" y1="-2" x2="6" y2="0" stroke="#1F1E1D" stroke-width="1.9" stroke-linecap="round"/>
            <path d="M-17 -2 L-20 -7 L-15 -10 L-17 -15 L-11 -16 L-11 -21 L-5 -19 L-2 -23 L3 -19 L8 -21 L9 -15 L14 -13 L11 -7 L18 -5 L12 -2 Z" fill="#E8DEC9" stroke="#1F1E1D" stroke-width="1.7" stroke-linejoin="round"/>
            <path d="M5 -13 C12 -13, 18 -8, 20 -4 C16 -1, 7 -2, 4 -2 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.7" stroke-linejoin="round"/>
            <circle cx="13" cy="-7" r="1.3" fill="#1F1E1D"/>
            <circle cx="20" cy="-4.5" r="1.6" fill="#1F1E1D"/>
            <ellipse cx="11" cy="-4.5" rx="1.8" ry="1" fill="#F2B8A2" opacity="0.8"/>
            <line x1="-8" y1="-12" x2="-5" y2="-14" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round"/>
            <line x1="-2" y1="-14" x2="1" y2="-16" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round"/>
            <line x1="-5" y1="-8" x2="-2" y2="-10" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round"/>
          </g>
        </svg>
      `
    },
    {
      id: "white_rabbit",
      name: "깡총깡총 하얀 토끼",
      shortName: "하얀 토끼",
      category: "pet",
      categoryLabel: "🐾 동물",
      zoneLabel: "반려동물",
      price: 100,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 278, y: 345 },
      badge: "동물 친구",
      description: "긴 귀를 쫑긋이며 깡총 뛰는 토끼",
      reactionQuote: "깡총! 오늘도 화이팅 🐰 (부스트 +3%)",
      cardBg: "#FAF4EE",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(48, 60)">
            <circle cx="-16" cy="-6" r="4.2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.7"/>
            <path d="M-14 0 C-16 -12, -8 -20, 4 -18 C13 -17, 17 -9, 14 0 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.8" stroke-linejoin="round"/>
            <circle cx="9" cy="-16" r="8.5" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.8"/>
            <path d="M5 -23 C2 -35, 6 -39, 8 -24" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round"/>
            <path d="M10 -23 C11 -36, 16 -38, 14 -23" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round"/>
            <circle cx="12.5" cy="-17" r="1.4" fill="#1F1E1D"/>
            <ellipse cx="11" cy="-14" rx="2" ry="1.1" fill="#F2B8A2" opacity="0.85"/>
            <circle cx="17.2" cy="-15.5" r="1.2" fill="#E8845B"/>
          </g>
        </svg>
      `
    },
    {
      id: "goldfish_bowl",
      name: "유리 어항 속 금붕어",
      shortName: "어항 속 금붕어",
      category: "pet",
      categoryLabel: "🐾 동물",
      zoneLabel: "반려동물",
      price: 80,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 312, y: 160 },
      badge: "관상용",
      description: "맑은 어항 속 유유히 헤엄치는 친구",
      reactionQuote: "뻐끔... 집중력이 맑아져요 🐠 (부스트 +3%)",
      cardBg: "#EAF3F7",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 62)">
            <path d="M-12 0 L12 0 M-14 -27 C-21 -21, -21 -6, -12 0 L12 0 C21 -6, 21 -21, 14 -27 Z" fill="#F3FAFD" stroke="#1F1E1D" stroke-width="1.8" stroke-linejoin="round"/>
            <ellipse cx="0" cy="-27" rx="14" ry="3.2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.75"/>
            <path d="M-16 -19 Q-8 -21 0 -19 T16 -19" fill="none" stroke="#689EB3" stroke-width="1.3" stroke-linecap="round"/>
            <g transform="translate(1, -11)">
              <path d="M-7 0 L-12 -4 L-11 4 Z" fill="#D97736" stroke="#1F1E1D" stroke-width="1.3" stroke-linejoin="round"/>
              <ellipse cx="0" cy="0" rx="6.8" ry="4.2" fill="#D97736" stroke="#1F1E1D" stroke-width="1.45"/>
              <circle cx="3.5" cy="-1" r="1" fill="#1F1E1D"/>
            </g>
            <circle cx="5" cy="-22" r="1.5" fill="none" stroke="#689EB3" stroke-width="1.2"/>
          </g>
        </svg>
      `
    },

    /* =========================================================================
       [2. 🧸 펫 용품 (pet_goods) — 총 10종 (기존 5종 + 신규 5종)]
       ========================================================================= */
    {
      id: "beige_cushion",
      name: "폭신폭신 베이지 방석",
      shortName: "베이지 방석",
      category: "pet_goods",
      categoryLabel: "🧸 펫 용품",
      zoneLabel: "펫 용품",
      price: 80,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 238, y: 318 },
      badge: "방석",
      description: "낮잠을 부르는 폭신한 코튼 방석",
      reactionQuote: "폭신한 방석 위에서 낮잠 잘 준비 중 🧶",
      cardBg: "#F5ECE0",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="50" cy="50" rx="34" ry="15" fill="#F3E5D0" stroke="#1F1E1D" stroke-width="2"/>
          <ellipse cx="50" cy="48" rx="27" ry="10.5" fill="#FAF2E4" stroke="#1F1E1D" stroke-width="1.3" stroke-dasharray="3 2"/>
          <path d="M24 47 C34 55, 66 55, 76 47" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M43 44 Q50 48 57 44" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      `
    },
    {
      id: "tennis_ball",
      name: "통통 테니스공",
      shortName: "통통 테니스공",
      category: "pet_goods",
      categoryLabel: "🧸 펫 용품",
      zoneLabel: "펫 용품",
      price: 45,
      boostPercent: 2,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 106, y: 325 },
      badge: "장난감",
      description: "톡 건드리면 굴러가는 연두빛 공",
      reactionQuote: "통통! 데구르르 테니스공 장난감 🎾 (집중 부스트 +2%)",
      cardBg: "#EEF3E3",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="42" r="16" fill="#DCE9B8" stroke="#1F1E1D" stroke-width="2"/>
          <path d="M38 32 C45 38, 45 46, 38 52" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round" fill="none"/>
          <path d="M62 32 C55 38, 55 46, 62 52" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round" fill="none"/>
          <path d="M28 48 Q31 42 34 45" stroke="#D97736" stroke-width="1.5" stroke-linecap="round" fill="none"/>
        </svg>
      `
    },
    {
      id: "ceramic_bowl",
      name: "세라믹 물그릇",
      shortName: "세라믹 물그릇",
      category: "pet_goods",
      categoryLabel: "🧸 펫 용품",
      zoneLabel: "펫 용품",
      price: 60,
      boostPercent: 2,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 72, y: 304 },
      badge: "식기",
      description: "맑고 시원한 물이 담긴 도자기 보울",
      reactionQuote: "맑고 시원한 물이 담긴 공방 세라믹 물그릇 💧 (부스트 +2%)",
      cardBg: "#EFECE6",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M30 40 L70 40 L65 58 C64 61, 36 61, 35 58 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="2" stroke-linejoin="round"/>
          <ellipse cx="50" cy="40" rx="20" ry="6" fill="#E3F0F5" stroke="#1F1E1D" stroke-width="2"/>
          <path d="M40 40 Q45 38 50 40 T60 40" stroke="#75A8BD" stroke-width="1.6" stroke-linecap="round" fill="none"/>
          <circle cx="50" cy="51" r="2.2" fill="#D97736"/>
          <circle cx="46.5" cy="48" r="1.1" fill="#D97736"/>
          <circle cx="50" cy="47" r="1.1" fill="#D97736"/>
          <circle cx="53.5" cy="48" r="1.1" fill="#D97736"/>
        </svg>
      `
    },
    {
      id: "wall_wood_branch",
      name: "포근한 벽면 나뭇가지",
      shortName: "벽면 나뭇가지",
      category: "pet_goods",
      categoryLabel: "🧸 펫 용품",
      zoneLabel: "펫 용품",
      price: 80,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 306, y: 88 },
      badge: "신규",
      description: "앵무새가 날아와 쉬는 튼튼한 나뭇가지",
      reactionQuote: "왕관앵무가 날아와 포근하게 쉬어가는 벽면 나뭇가지 🌿 (부스트 +3%)",
      cardBg: "#EFF3E5",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 38)">
            <ellipse cx="32" cy="1" rx="3.6" ry="8.2" fill="#D8C3A5" stroke="#1F1E1D" stroke-width="1.8"/>
            <path d="M32 -4 C14 -4.4, -10 -4.2, -29 -3.6 C-33.5 -3.4, -33.5 1.8, -29 2.2 C-10 2.6, 14 3.4, 32 5.8 Z" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.85" stroke-linejoin="round"/>
            <line x1="-18" y1="-0.8" x2="12" y2="-0.2" stroke="#1F1E1D" stroke-width="1.15" stroke-linecap="round" opacity="0.55"/>
            <path d="M-9 2.3 C-14 8.5, -21 11.8, -27 12.6" fill="none" stroke="#1F1E1D" stroke-width="1.75" stroke-linecap="round"/>
            <path d="M9 2.8 C5 8.5, 0 12.2, -5 13.8" fill="none" stroke="#1F1E1D" stroke-width="1.65" stroke-linecap="round"/>
            <path d="M-27 12.6 C-34 14.5, -34 7.5, -27.5 6.8 C-22.5 6.2, -21.8 11.2, -27 12.6 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.55"/>
            <path d="M-16 9.8 C-20.5 15.2, -14.2 19.2, -11.5 13.4 C-9.8 9.6, -13 7.8, -16 9.8 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.5"/>
            <path d="M-5 13.8 C-9.2 19.5, -1.2 21.5, 1.2 15.2 C2.4 11.5, -2.5 10.2, -5 13.8 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.55"/>
          </g>
        </svg>
      `
    },
    {
      id: "yarn_ball",
      name: "포근 털실 뭉치",
      shortName: "털실 뭉치",
      category: "pet_goods",
      categoryLabel: "🧸 펫 용품",
      zoneLabel: "펫 용품",
      price: 40,
      boostPercent: 2,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 288, y: 332 },
      badge: "장난감",
      description: "앞발로 톡톡 굴리는 살구빛 털실",
      reactionQuote: "톡톡 굴리면 실이 풀리는 포근 털실 뭉치 🧶 (부스트 +2%)",
      cardBg: "#F9ECE4",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="48" cy="42" r="16" fill="#F5C7B0" stroke="#1F1E1D" stroke-width="2"/>
          <path d="M36 35 C44 32, 54 38, 58 48" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M35 46 C43 42, 52 46, 56 54" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M44 27 C52 33, 56 41, 52 52" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M60 52 C66 56, 72 52, 76 56" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        </svg>
      `
    },
    {
      id: "wooden_bird_perch",
      name: "원목 새 횃대",
      shortName: "원목 새 횃대",
      category: "pet_goods",
      categoryLabel: "🧸 펫 용품",
      zoneLabel: "펫 용품",
      price: 85,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 244, y: 274 },
      badge: "신규",
      description: "왕관앵무가 쉬어가는 원목 횃대",
      reactionQuote: "왕관앵무가 날아와 앉기 좋아하는 원목 새 횃대예요 🦜 (부스트 +3%)",
      cardBg: "#F5ECE0",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 68)">
            <ellipse cx="0" cy="-2" rx="19" ry="4.2" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.8"/>
            <line x1="0" y1="-4" x2="0" y2="-48" stroke="#1F1E1D" stroke-width="2.2" stroke-linecap="round"/>
            <rect x="-23" y="-52" width="46" height="4.8" rx="2.4" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.8"/>
            <line x1="-13" y1="-33" x2="0" y2="-27" stroke="#1F1E1D" stroke-width="1.85" stroke-linecap="round"/>
            <path d="M15 -47.2 L15 -40" stroke="#1F1E1D" stroke-width="1.35" stroke-linecap="round"/>
            <circle cx="15" cy="-38" r="2.5" fill="#F4C065" stroke="#1F1E1D" stroke-width="1.35"/>
          </g>
        </svg>
      `
    },
    {
      id: "mini_cat_tower",
      name: "미니 원목 캣타워",
      shortName: "미니 캣타워",
      category: "pet_goods",
      categoryLabel: "🧸 펫 용품",
      zoneLabel: "펫 용품",
      price: 130,
      boostPercent: 4,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 64, y: 318 },
      badge: "인기",
      description: "고양이들이 좋아하는 아늑한 타워",
      reactionQuote: "고양이가 좋아하는 3단 원목 캣타워 🐾",
      cardBg: "#F6EFE4",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 72) scale(0.68)">
            <rect x="-36" y="-6" width="72" height="6" rx="2.5" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="2.2"/>
            <rect x="-20" y="-23" width="6.5" height="17" fill="#F5EBDC" stroke="#1F1E1D" stroke-width="2"/>
            <rect x="-34" y="-28" width="34" height="5.5" rx="2.5" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="2.1"/>
            <rect x="13.5" y="-54.5" width="7" height="48.5" fill="#F5EBDC" stroke="#1F1E1D" stroke-width="2"/>
            <line x1="13.5" y1="-44" x2="20.5" y2="-41" stroke="#1F1E1D" stroke-width="1.5"/>
            <line x1="13.5" y1="-34" x2="20.5" y2="-31" stroke="#1F1E1D" stroke-width="1.5"/>
            <line x1="13.5" y1="-24" x2="20.5" y2="-21" stroke="#1F1E1D" stroke-width="1.5"/>
            <rect x="0" y="-60" width="34" height="5.5" rx="2.5" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="2.1"/>
            <rect x="-15" y="-88" width="6.5" height="60" fill="#F5EBDC" stroke="#1F1E1D" stroke-width="2"/>
            <path d="M-31 -94 L7 -94 L4 -88 L-28 -88 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="2.1" stroke-linejoin="round"/>
            <rect x="-33" y="-96" width="42" height="4.2" rx="2" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="2"/>
            <line x1="27" y1="-54.5" x2="27" y2="-44" stroke="#1F1E1D" stroke-width="1.6"/>
            <circle cx="27" cy="-41" r="3.4" fill="#E99A7E" stroke="#1F1E1D" stroke-width="1.6"/>
          </g>
        </svg>
      `
    },
    {
      id: "cozy_tent_house",
      name: "아늑한 텐트 숨숨집",
      shortName: "텐트 숨숨집",
      category: "pet_goods",
      categoryLabel: "🧸 펫 용품",
      zoneLabel: "펫 용품",
      price: 110,
      boostPercent: 4,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 312, y: 326 },
      badge: "숨숨집",
      description: "포근하게 쏙 들어가는 인디언 텐트",
      reactionQuote: "아늑하게 쏙 들어가 쉬는 인디언 텐트 ⛺",
      cardBg: "#F7EFE6",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 68) scale(0.88)">
            <line x1="-29" y1="0" x2="5" y2="-58" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round"/>
            <line x1="29" y1="0" x2="-5" y2="-58" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round"/>
            <line x1="0" y1="0" x2="0" y2="-60" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round"/>
            <polygon points="0,-51 -30,0 30,0" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="2" stroke-linejoin="round"/>
            <polygon points="0,-25 -13,0 13,0" fill="#EAE0D0" stroke="#1F1E1D" stroke-width="1.7" stroke-linejoin="round"/>
            <ellipse cx="0" cy="-1.5" rx="12" ry="3.2" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.5"/>
          </g>
        </svg>
      `
    },
    {
      id: "yellow_duck_toy",
      name: "노란 오리 삑삑이",
      shortName: "오리 삑삑이",
      category: "pet_goods",
      categoryLabel: "🧸 펫 용품",
      zoneLabel: "펫 용품",
      price: 45,
      boostPercent: 2,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 162, y: 160 },
      badge: "장난감",
      description: "누르면 삑삑 소리 나는 귀여운 오리",
      reactionQuote: "삑삑! 말랑말랑 귀여운 노란 오리 장난감 🐤 (부스트 +2%)",
      cardBg: "#FAF2DC",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 56)">
            <path d="M-11 0 C-14 0, -16 -9, -9 -12 C-3 -13, 8 -13, 12 -8 C15 -4, 12 0, 8 0 Z" fill="#F9E07F" stroke="#1F1E1D" stroke-width="1.85" stroke-linejoin="round"/>
            <circle cx="5" cy="-15.5" r="7" fill="#F9E07F" stroke="#1F1E1D" stroke-width="1.85"/>
            <circle cx="7.2" cy="-17" r="1.35" fill="#1F1E1D"/>
            <path d="M11.5 -16 L16.5 -14.5 L11.5 -13 Z" fill="#E8845B" stroke="#1F1E1D" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M-5 -6 C-1 -8, 4 -7, 3 -4" fill="none" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round"/>
          </g>
        </svg>
      `
    },
    {
      id: "hamster_wheel",
      name: "우드 햄스터 쳇바퀴",
      shortName: "햄스터 쳇바퀴",
      category: "pet_goods",
      categoryLabel: "🧸 펫 용품",
      zoneLabel: "펫 용품",
      price: 75,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 118, y: 160 },
      badge: "신규",
      description: "빙글빙글 돌아가는 미니 쳇바퀴",
      reactionQuote: "빙글빙글 신나게 달리는 우드 쳇바퀴 🐹",
      cardBg: "#F4EDE1",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 66)">
            <rect x="-20" y="-4.5" width="40" height="4.5" rx="2" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.8"/>
            <path d="M-11 -4.5 L0 -26 L11 -4.5" fill="none" stroke="#1F1E1D" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
            <g transform="translate(0, -26)">
              <circle cx="0" cy="0" r="19" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.9"/>
              <circle cx="0" cy="0" r="15" fill="none" stroke="#E9DAC6" stroke-width="1.6"/>
              <line x1="-15" y1="0" x2="15" y2="0" stroke="#1F1E1D" stroke-width="1.35"/>
              <line x1="0" y1="-15" x2="0" y2="15" stroke="#1F1E1D" stroke-width="1.35"/>
              <circle cx="0" cy="0" r="2.8" fill="#D97736" stroke="#1F1E1D" stroke-width="1.45"/>
            </g>
          </g>
        </svg>
      `
    },

    /* =========================================================================
       [3. 💡 가구·조명 (furniture) — 총 10종 (기존 2종 + 신규 8종)]
       ========================================================================= */
    {
      id: "stand_lamp",
      name: "따뜻한 스탠드 조명",
      shortName: "스탠드 조명",
      category: "furniture",
      categoryLabel: "💡 가구·조명",
      zoneLabel: "가구·조명",
      price: 110,
      boostPercent: 4,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 336, y: 266 },
      badge: "무드등",
      description: "거실을 포근하게 비추는 웜톤 조명",
      reactionQuote: "은은한 온기를 더해주는 우드 스탠드 조명 💡 (부스트 +4%)",
      cardBg: "#F6EBDD",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="28" r="18" fill="#F9E5C2" opacity="0.65"/>
          <path d="M38 18 L62 18 L67 34 L33 34 Z" fill="#FFF7E8" stroke="#1F1E1D" stroke-width="2" stroke-linejoin="round"/>
          <path d="M47 34 Q50 39 53 34" stroke="#D97736" stroke-width="1.8" fill="#F6B962"/>
          <line x1="56" y1="34" x2="56" y2="41" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round"/>
          <circle cx="56" cy="42" r="1.5" fill="#1F1E1D"/>
          <line x1="50" y1="34" x2="50" y2="65" stroke="#1F1E1D" stroke-width="2.2" stroke-linecap="round"/>
          <ellipse cx="50" cy="66" rx="14" ry="3.5" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="2"/>
        </svg>
      `
    },
    {
      id: "mini_bookshelf",
      name: "원목 미니 책꽂이",
      shortName: "미니 책꽂이",
      category: "furniture",
      categoryLabel: "💡 가구·조명",
      zoneLabel: "가구·조명",
      price: 90,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 64, y: 244 },
      badge: "가구",
      description: "차분한 독서 무드의 원목 책꽂이",
      reactionQuote: "차분한 독서 무드를 만들어주는 원목 미니 책꽂이 📚 (부스트 +3%)",
      cardBg: "#F4ECE1",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="26" y="48" width="48" height="7" rx="2" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.9"/>
          <line x1="32" y1="55" x2="30" y2="64" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round"/>
          <line x1="68" y1="55" x2="70" y2="64" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round"/>
          <rect x="31" y="24" width="9" height="24" rx="1.5" fill="#DFECC6" stroke="#1F1E1D" stroke-width="1.8"/>
          <rect x="40" y="20" width="10" height="28" rx="1.5" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.8"/>
          <rect x="52" y="23" width="9" height="25" rx="1.5" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.8" transform="rotate(8 52 23)"/>
        </svg>
      `
    },
    {
      id: "cloud_wall_lamp",
      name: "몽글 구름 벽조명",
      shortName: "구름 벽조명",
      category: "furniture",
      categoryLabel: "💡 가구·조명",
      zoneLabel: "가구·조명",
      price: 120,
      boostPercent: 4,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 68, y: 96 },
      badge: "벽조명",
      description: "벽면을 포근히 비추는 구름 무드등",
      reactionQuote: "몽글몽글 구름 뒤로 은은한 온기가 번져요 ☁️ (부스트 +4%)",
      cardBg: "#FAF1E2",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="50" cy="40" rx="28" ry="18" fill="#F9E5C2" opacity="0.7"/>
          <g transform="translate(50, 42)">
            <path d="M-16 9 L15 9 C21 9, 24 3, 19 -1 C20 -8, 12 -12, 7 -8 C4 -15, -7 -15, -10 -7 C-17 -8, -22 -2, -19 4 C-22 6, -20 9, -16 9 Z" fill="#FFF3C8" stroke="#1F1E1D" stroke-width="1.85" stroke-linejoin="round"/>
            <path d="M-6 1 Q-4 3 -2 1" fill="none" stroke="#1F1E1D" stroke-width="1.35" stroke-linecap="round"/>
            <path d="M3 1 Q5 3 7 1" fill="none" stroke="#1F1E1D" stroke-width="1.35" stroke-linecap="round"/>
            <ellipse cx="-8" cy="2.5" rx="1.8" ry="1" fill="#F2B8A2" opacity="0.8"/>
            <ellipse cx="9" cy="2.5" rx="1.8" ry="1" fill="#F2B8A2" opacity="0.8"/>
          </g>
        </svg>
      `
    },
    {
      id: "crescent_mood_lamp",
      name: "초승달 무드등",
      shortName: "초승달 무드등",
      category: "furniture",
      categoryLabel: "💡 가구·조명",
      zoneLabel: "가구·조명",
      price: 100,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 250, y: 160 },
      badge: "무드등",
      description: "밤하늘을 담은 따뜻한 달빛 조명",
      reactionQuote: "초승달 무드등이 밤하늘처럼 포근하게 빛나요 🌙 (부스트 +3%)",
      cardBg: "#FAF0DF",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="40" r="20" fill="#F9E5C2" opacity="0.65"/>
          <g transform="translate(50, 58)">
            <rect x="-11" y="-4" width="22" height="4" rx="1.8" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.75"/>
            <path d="M2 -29 C-11 -29, -15 -11, 2 -5 C-5 -10, -4 -23, 2 -29 Z" fill="#FFE79B" stroke="#1F1E1D" stroke-width="1.8" stroke-linejoin="round"/>
            <circle cx="6" cy="-18" r="1.8" fill="#F4C065"/>
          </g>
        </svg>
      `
    },
    {
      id: "mushroom_stand_lamp",
      name: "버섯 단스탠드",
      shortName: "버섯 단스탠드",
      category: "furniture",
      categoryLabel: "💡 가구·조명",
      zoneLabel: "가구·조명",
      price: 95,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 48, y: 160 },
      badge: "조명",
      description: "동글동글 귀여운 버섯 모양 램프",
      reactionQuote: "동글한 버섯 단스탠드를 따뜻하게 켰어요 🍄 (부스트 +3%)",
      cardBg: "#F8EEE0",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="36" r="19" fill="#F9E5C2" opacity="0.65"/>
          <g transform="translate(50, 58)">
            <path d="M-7 0 L-5 -14 L5 -14 L7 0 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M-16 -14 C-16 -27, 16 -27, 16 -14 Z" fill="#FFECB8" stroke="#1F1E1D" stroke-width="1.85" stroke-linejoin="round"/>
            <line x1="6" y1="-14" x2="6" y2="-9" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round"/>
            <circle cx="6" cy="-8" r="1.4" fill="#D97736"/>
          </g>
        </svg>
      `
    },
    {
      id: "starlight_garland",
      name: "별빛 가랜드 조명",
      shortName: "별빛 가랜드",
      category: "furniture",
      categoryLabel: "💡 가구·조명",
      zoneLabel: "가구·조명",
      price: 115,
      boostPercent: 4,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 190, y: -8 },
      badge: "줄조명",
      description: "반짝반짝 감성을 더하는 줄조명",
      reactionQuote: "별빛 가랜드 전구들이 반짝반짝 빛나요 ✨ (부스트 +4%)",
      cardBg: "#FAF1E1",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 32)">
            <path d="M-36 -6 Q0 10 36 -6" fill="none" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round"/>
            <circle cx="-36" cy="-6" r="2" fill="#1F1E1D"/>
            <circle cx="36" cy="-6" r="2" fill="#1F1E1D"/>
            <line x1="-22" y1="-1" x2="-22" y2="6" stroke="#1F1E1D" stroke-width="1.3"/>
            <line x1="-8" y1="2" x2="-8" y2="10" stroke="#1F1E1D" stroke-width="1.3"/>
            <line x1="8" y1="2" x2="8" y2="10" stroke="#1F1E1D" stroke-width="1.3"/>
            <line x1="22" y1="-1" x2="22" y2="6" stroke="#1F1E1D" stroke-width="1.3"/>
            <circle cx="-22" cy="9" r="3.4" fill="#FFE688" stroke="#1F1E1D" stroke-width="1.5"/>
            <circle cx="-8" cy="13" r="3.6" fill="#FFE688" stroke="#1F1E1D" stroke-width="1.5"/>
            <circle cx="8" cy="13" r="3.6" fill="#FFE688" stroke="#1F1E1D" stroke-width="1.5"/>
            <circle cx="22" cy="9" r="3.4" fill="#FFE688" stroke="#1F1E1D" stroke-width="1.5"/>
          </g>
        </svg>
      `
    },
    {
      id: "cozy_single_sofa",
      name: "포근 1인용 소파",
      shortName: "1인용 소파",
      category: "furniture",
      categoryLabel: "💡 가구·조명",
      zoneLabel: "가구·조명",
      price: 150,
      boostPercent: 5,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 86, y: 274 },
      badge: "가구",
      description: "푹신하게 기대어 쉬는 패브릭 소파",
      reactionQuote: "폭신폭신 기대어 쉬기 좋은 패브릭 1인용 소파 🛋️ (부스트 +5%)",
      cardBg: "#F6ECE1",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 62)">
            <line x1="-18" y1="-6" x2="-20" y2="0" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round"/>
            <line x1="18" y1="-6" x2="20" y2="0" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round"/>
            <rect x="-20" y="-36" width="40" height="24" rx="9" fill="#F5EBDC" stroke="#1F1E1D" stroke-width="1.85"/>
            <rect x="-25" y="-23" width="9" height="17" rx="4.5" fill="#EAE0D0" stroke="#1F1E1D" stroke-width="1.75"/>
            <rect x="16" y="-23" width="9" height="17" rx="4.5" fill="#EAE0D0" stroke="#1F1E1D" stroke-width="1.75"/>
            <rect x="-16" y="-15" width="32" height="9" rx="4" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.75"/>
            <rect x="-9" y="-26" width="11" height="11" rx="3" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.5" transform="rotate(-10 -3 -20)"/>
          </g>
        </svg>
      `
    },
    {
      id: "wooden_tea_table",
      name: "원목 티테이블",
      shortName: "원목 티테이블",
      category: "furniture",
      categoryLabel: "💡 가구·조명",
      zoneLabel: "가구·조명",
      price: 105,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 192, y: 344 },
      badge: "가구",
      description: "따뜻한 차 한 잔 올리는 원형 탁자",
      reactionQuote: "따뜻한 허브티가 놓인 아담한 원목 티테이블 ☕ (부스트 +3%)",
      cardBg: "#F5EDE1",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 62)">
            <line x1="-12" y1="-16" x2="-16" y2="0" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round"/>
            <line x1="12" y1="-16" x2="16" y2="0" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round"/>
            <line x1="0" y1="-15" x2="0" y2="-1" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round"/>
            <ellipse cx="0" cy="-18" rx="24" ry="7" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.85"/>
            <ellipse cx="2" cy="-19.5" rx="6" ry="2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.4"/>
            <path d="M-2 -24 L6 -24 L5 -19.5 L-1 -19.5 Z" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M1.5 -27 Q2.8 -29.5 1.5 -32" fill="none" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round"/>
          </g>
        </svg>
      `
    },
    {
      id: "vintage_turntable",
      name: "빈티지 턴테이블",
      shortName: "빈티지 턴테이블",
      category: "furniture",
      categoryLabel: "💡 가구·조명",
      zoneLabel: "가구·조명",
      price: 140,
      boostPercent: 5,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 252, y: 266 },
      badge: "인기",
      description: "잔잔한 음악이 흐르는 LP 플레이어",
      reactionQuote: "LP에서 포근한 아날로그 선율이 흘러요 🎵",
      cardBg: "#F4ECE2",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 56)">
            <rect x="-22" y="-7" width="44" height="7" rx="2" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.8"/>
            <polygon points="-22,-7 -16,-19 16,-19 22,-7" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.8" stroke-linejoin="round"/>
            <ellipse cx="-2" cy="-13" rx="12" ry="4.6" fill="#2C2A29" stroke="#1F1E1D" stroke-width="1.5"/>
            <ellipse cx="-2" cy="-13" rx="4.2" ry="1.7" fill="#E8845B"/>
            <line x1="13" y1="-16" x2="5" y2="-11" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round"/>
            <text x="-4" y="-24" fill="#D97736" font-size="11" font-weight="700">♪</text>
            <text x="6" y="-29" fill="#1F1E1D" font-size="10" font-weight="700">♫</text>
          </g>
        </svg>
      `
    },
    {
      id: "rattan_basket",
      name: "라탄 수납 바구니",
      shortName: "라탄 바구니",
      category: "furniture",
      categoryLabel: "💡 가구·조명",
      zoneLabel: "가구·조명",
      price: 70,
      boostPercent: 2,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 325, y: 365 },
      badge: "수납",
      description: "소품을 담아두는 내추럴 라탄 바구니",
      reactionQuote: "포근한 담요가 쏙 담긴 내추럴 라탄 바구니 🧺 (부스트 +2%)",
      cardBg: "#F5EDE1",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 62)">
            <path d="M-8 -18 C-4 -25, 10 -24, 12 -18 Z" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.6"/>
            <path d="M-16 -18 L16 -18 L13 0 L-13 0 Z" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.85" stroke-linejoin="round"/>
            <path d="M-14 -18 C-14 -23, -8 -23, -8 -18" fill="none" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round"/>
            <path d="M8 -18 C8 -23, 14 -23, 14 -18" fill="none" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round"/>
            <line x1="-14.5" y1="-12" x2="14.5" y2="-12" stroke="#1F1E1D" stroke-width="1.3"/>
            <line x1="-13.5" y1="-6" x2="13.5" y2="-6" stroke="#1F1E1D" stroke-width="1.3"/>
          </g>
        </svg>
      `
    },

    /* =========================================================================
       [4. 🪴 식물·데코 (decor) — 총 10종 (기존 2종 + 신규 8종)]
       ========================================================================= */
    {
      id: "monstera_pot",
      name: "싱그러운 몬스테라 화분",
      shortName: "몬스테라 화분",
      category: "decor",
      categoryLabel: "🪴 식물·데코",
      zoneLabel: "식물·데코",
      price: 65,
      boostPercent: 2,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 73, y: 160 },
      badge: "식물",
      description: "거실에 생기를 더하는 반려 식물",
      reactionQuote: "싱그러운 몬스테라 화분 🌱 (집중 부스트 +2%)",
      cardBg: "#EBF1E2",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="20" y1="68" x2="80" y2="68" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round"/>
          <path d="M40 48 L60 48 L56.5 68 L43.5 68 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.9" stroke-linejoin="round"/>
          <rect x="38" y="44" width="24" height="4.2" rx="1.2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.9"/>
          <path d="M50 44 C49 33, 44 25, 37 19" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M50 44 C50 31, 51 22, 50 13" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M50 44 C52 34, 57 26, 63 20" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M37 19 C31 16, 30 24, 36 26 C41 28, 42 22, 37 19 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.7"/>
          <path d="M43 31 C37 29, 36 36, 42 37 C46 38, 47 33, 43 31 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.65"/>
          <path d="M50 13 C45 8, 55 8, 53 15 C52 20, 48 19, 50 13 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.7"/>
          <path d="M63 20 C69 17, 69 25, 63 27 C58 28, 58 22, 63 20 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.7"/>
          <path d="M57 32 C63 30, 63 37, 58 38 C54 39, 53 34, 57 32 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.65"/>
        </svg>
      `
    },
    {
      id: "wall_clock",
      name: "빈티지 아날로그 벽시계",
      shortName: "빈티지 벽시계",
      category: "decor",
      categoryLabel: "🪴 식물·데코",
      zoneLabel: "식물·데코",
      price: 85,
      boostPercent: 2,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 304, y: 92 },
      badge: "인테리어",
      description: "고요히 시간을 담은 크림 벽시계",
      reactionQuote: "고요한 시간을 담아내는 빈티지 아날로그 벽시계 🕰️ (부스트 +2%)",
      cardBg: "#F5F0E6",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="40" r="21" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="2"/>
          <circle cx="50" cy="40" r="17" fill="none" stroke="#E6DEC8" stroke-width="1.2"/>
          <line x1="50" y1="23" x2="50" y2="26" stroke="#1F1E1D" stroke-width="1.6" stroke-linecap="round"/>
          <line x1="50" y1="54" x2="50" y2="57" stroke="#1F1E1D" stroke-width="1.6" stroke-linecap="round"/>
          <line x1="33" y1="40" x2="36" y2="40" stroke="#1F1E1D" stroke-width="1.6" stroke-linecap="round"/>
          <line x1="64" y1="40" x2="67" y2="40" stroke="#1F1E1D" stroke-width="1.6" stroke-linecap="round"/>
          <polyline points="50,29 50,40 58,44" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="50" cy="40" r="2" fill="#D97736"/>
        </svg>
      `
    },
    {
      id: "mini_cactus_pot",
      name: "미니 선인장 화분",
      shortName: "미니 선인장",
      category: "decor",
      categoryLabel: "🪴 식물·데코",
      zoneLabel: "식물·데코",
      price: 55,
      boostPercent: 2,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 144, y: 160 },
      badge: "식물",
      description: "창가에 딱 어울리는 귀여운 선인장",
      reactionQuote: "분홍 꽃이 피어난 동글동글 미니 선인장 화분 🌵 (부스트 +2%)",
      cardBg: "#EEF3E4",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 62)">
            <path d="M-9 -14 L9 -14 L6.5 0 L-6.5 0 Z" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.8" stroke-linejoin="round"/>
            <rect x="-10.5" y="-17.5" width="21" height="3.5" rx="1.2" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.75"/>
            <ellipse cx="0" cy="-26" rx="7.5" ry="10.5" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.8"/>
            <circle cx="6.5" cy="-28.5" r="3.4" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.65"/>
            <circle cx="0" cy="-37" r="2.8" fill="#E99A7E" stroke="#1F1E1D" stroke-width="1.5"/>
            <line x1="-2.5" y1="-28" x2="-3.5" y2="-29" stroke="#1F1E1D" stroke-width="1.2" stroke-linecap="round"/>
            <line x1="2.5" y1="-23" x2="3.5" y2="-24" stroke="#1F1E1D" stroke-width="1.2" stroke-linecap="round"/>
          </g>
        </svg>
      `
    },
    {
      id: "tulip_glass_vase",
      name: "튤립 유리 화병",
      shortName: "튤립 유리 화병",
      category: "decor",
      categoryLabel: "🪴 식물·데코",
      zoneLabel: "식물·데코",
      price: 75,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 228, y: 160 },
      badge: "플라워",
      description: "산뜻한 튤립이 꽂힌 투명 유리병",
      reactionQuote: "투명한 유리병 속 산뜻한 튤립 두 송이 🌷 (부스트 +3%)",
      cardBg: "#F9ECE8",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 62)">
            <path d="M-4 -8 C-4 -19, -7 -26, -8 -31" fill="none" stroke="#4F6F33" stroke-width="1.7" stroke-linecap="round"/>
            <path d="M2 -8 C2 -20, 5 -28, 7 -34" fill="none" stroke="#4F6F33" stroke-width="1.7" stroke-linecap="round"/>
            <path d="M-7 -20 L7 -20 L10 -4 C10 -1, -10 -1, -10 -4 Z" fill="#F3FAFD" fill-opacity="0.82" stroke="#1F1E1D" stroke-width="1.75" stroke-linejoin="round"/>
            <path d="M-8.5 -10 Q0 -11.5 8.5 -10" fill="none" stroke="#689EB3" stroke-width="1.25" stroke-linecap="round"/>
            <path d="M-12 -31 C-12 -37, -4 -37, -4 -31 C-4 -27, -12 -27, -12 -31 Z" fill="#E99A7E" stroke="#1F1E1D" stroke-width="1.6"/>
            <path d="M3 -34 C3 -40, 11 -40, 11 -34 C11 -30, 3 -30, 3 -34 Z" fill="#F4C065" stroke="#1F1E1D" stroke-width="1.6"/>
          </g>
        </svg>
      `
    },
    {
      id: "hanging_plant",
      name: "하늘하늘 행잉 플랜트",
      shortName: "행잉 플랜트",
      category: "decor",
      categoryLabel: "🪴 식물·데코",
      zoneLabel: "식물·데코",
      price: 90,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 82, y: 60 },
      badge: "식물",
      description: "줄기가 살랑이는 공중 걸이 화분",
      reactionQuote: "바람을 타고 초록 줄기가 하늘하늘 살랑여요 🌿 (부스트 +3%)",
      cardBg: "#ECF2E4",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 44)">
            <circle cx="0" cy="-26" r="2.2" fill="none" stroke="#1F1E1D" stroke-width="1.6"/>
            <line x1="0" y1="-24" x2="-10" y2="-8" stroke="#1F1E1D" stroke-width="1.35"/>
            <line x1="0" y1="-24" x2="10" y2="-8" stroke="#1F1E1D" stroke-width="1.35"/>
            <path d="M-11 -8 L11 -8 L8 2 L-8 2 Z" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.8" stroke-linejoin="round"/>
            <path d="M-7 0 Q-12 10 -8 20" fill="none" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M0 2 Q2 12 -1 22" fill="none" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M7 0 Q12 9 9 18" fill="none" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="-9" cy="8" r="2.6" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.35"/>
            <circle cx="-8" cy="18" r="2.6" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.35"/>
            <circle cx="1" cy="11" r="2.6" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.35"/>
            <circle cx="-1" cy="21" r="2.6" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.35"/>
            <circle cx="10" cy="8" r="2.6" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.35"/>
            <circle cx="9" cy="17" r="2.6" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.35"/>
          </g>
        </svg>
      `
    },
    {
      id: "croquis_frame",
      name: "크로키 풍경 액자",
      shortName: "크로키 액자",
      category: "decor",
      categoryLabel: "🪴 식물·데코",
      zoneLabel: "식물·데코",
      price: 85,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 312, y: 128 },
      badge: "액자",
      description: "연필 선으로 그린 잔잔한 풍경 액자",
      reactionQuote: "연필 선으로 고요한 언덕과 해를 담아낸 풍경 액자 🖼️ (부스트 +3%)",
      cardBg: "#F5EFE4",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 42)">
            <path d="M-7 -15 L0 -21 L7 -15" fill="none" stroke="#1F1E1D" stroke-width="1.35"/>
            <circle cx="0" cy="-21" r="1.4" fill="#1F1E1D"/>
            <rect x="-18" y="-15" width="36" height="28" rx="2.5" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.85"/>
            <rect x="-14" y="-11" width="28" height="20" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.4"/>
            <circle cx="6" cy="-4" r="3.4" fill="#F4C065" stroke="#1F1E1D" stroke-width="1.35"/>
            <path d="M-14 7 Q-6 -2 2 5 T14 4 L14 9 L-14 9 Z" fill="#DFECC6" stroke="#1F1E1D" stroke-width="1.35" stroke-linejoin="round"/>
          </g>
        </svg>
      `
    },
    {
      id: "aroma_candle",
      name: "따뜻한 아로마 캔들",
      shortName: "아로마 캔들",
      category: "decor",
      categoryLabel: "🪴 식물·데코",
      zoneLabel: "식물·데코",
      price: 65,
      boostPercent: 2,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 168, y: 92 },
      badge: "향초",
      description: "은은한 향기가 퍼지는 미니 향초",
      reactionQuote: "따스한 촛불과 함께 은은한 아로마 향기가 퍼져요 🕯️ (부스트 +2%)",
      cardBg: "#FAF1E2",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="30" r="15" fill="#F9E5C2" opacity="0.65"/>
          <g transform="translate(50, 58)">
            <rect x="-10" y="-2.5" width="20" height="2.5" rx="1" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.6"/>
            <rect x="-8" y="-18" width="16" height="15.5" rx="2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.8"/>
            <rect x="-5" y="-12.5" width="10" height="5.5" rx="1" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.25"/>
            <line x1="0" y1="-18" x2="0" y2="-20.5" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M0 -28 C-3.2 -24, -2.5 -20.5, 0 -20.5 C2.5 -20.5, 3.2 -24, 0 -28 Z" fill="#FFB347" stroke="#1F1E1D" stroke-width="1.35" stroke-linejoin="round"/>
          </g>
        </svg>
      `
    },
    {
      id: "cozy_dreamcatcher",
      name: "포근 드림캐처",
      shortName: "포근 드림캐처",
      category: "decor",
      categoryLabel: "🪴 식물·데코",
      zoneLabel: "식물·데코",
      price: 80,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 332, y: 66 },
      badge: "월행잉",
      description: "좋은 꿈만 모아주는 감성 월행잉",
      reactionQuote: "깃털이 살랑이며 좋은 기운과 집중력을 모아줘요 🪶 (부스트 +3%)",
      cardBg: "#F7EFE6",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 38)">
            <line x1="0" y1="-22" x2="0" y2="-15" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="0" cy="-4" r="11" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.8"/>
            <polygon points="0,-12 7,-4 0,4 -7,-4" fill="none" stroke="#1F1E1D" stroke-width="1.2"/>
            <circle cx="0" cy="-4" r="2.2" fill="#D97736"/>
            <path d="M-6 6 L-6 13 C-9 17, -9 22, -6 25 C-3 22, -3 17, -6 13 Z" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.4"/>
            <path d="M0 7 L0 15 C-3.2 20, -3.2 25, 0 28 C3.2 25, 3.2 20, 0 15 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.4"/>
            <path d="M6 6 L6 13 C3 17, 3 22, 6 25 C9 22, 9 17, 6 13 Z" fill="#DFECC6" stroke="#1F1E1D" stroke-width="1.4"/>
          </g>
        </svg>
      `
    },
    {
      id: "mini_desk_calendar",
      name: "감성 미니 달력",
      shortName: "감성 미니 달력",
      category: "decor",
      categoryLabel: "🪴 식물·데코",
      zoneLabel: "식물·데코",
      price: 60,
      boostPercent: 2,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 214, y: 92 },
      badge: "데코",
      description: "오늘의 날짜를 기록하는 탁상 달력",
      reactionQuote: "하루하루 소중한 집중을 기록하는 감성 탁상 달력 📅 (부스트 +2%)",
      cardBg: "#F6EFE4",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 58)">
            <polygon points="-13,0 13,0 16,-4 -10,-4" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.6" stroke-linejoin="round"/>
            <rect x="-13" y="-23" width="26" height="23" rx="2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.85"/>
            <path d="M-13 -17 L13 -17" stroke="#1F1E1D" stroke-width="1.5"/>
            <line x1="-7" y1="-25.5" x2="-7" y2="-20.5" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="0" y1="-25.5" x2="0" y2="-20.5" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round"/>
            <line x1="7" y1="-25.5" x2="7" y2="-20.5" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round"/>
            <text x="0" y="-5" text-anchor="middle" fill="#D97736" font-size="11" font-weight="800" font-family="sans-serif">24</text>
          </g>
        </svg>
      `
    },
    {
      id: "sparkle_snow_globe",
      name: "반짝 스노우볼",
      shortName: "반짝 스노우볼",
      category: "decor",
      categoryLabel: "🪴 식물·데코",
      zoneLabel: "식물·데코",
      price: 95,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      defaultPos: { x: 332, y: 160 },
      badge: "신규",
      description: "흔들면 눈이 내리는 유리 스노우볼",
      reactionQuote: "스노우볼에 하얀 눈송이가 흩날려요 ❄️",
      cardBg: "#ECF3F6",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(50, 60)">
            <path d="M-13 0 L13 0 L10 -6 L-10 -6 Z" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.8" stroke-linejoin="round"/>
            <circle cx="0" cy="-18" r="14" fill="#F3FAFD" stroke="#1F1E1D" stroke-width="1.85"/>
            <polygon points="0,-25 -5,-15 5,-15" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.45" stroke-linejoin="round"/>
            <line x1="0" y1="-15" x2="0" y2="-11" stroke="#1F1E1D" stroke-width="1.5"/>
            <path d="M-11 -11 Q0 -13 11 -11" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.3"/>
            <circle cx="-6" cy="-23" r="1.3" fill="#D97736"/>
            <circle cx="6" cy="-21" r="1.3" fill="#D97736"/>
            <circle cx="-2" cy="-28" r="1.2" fill="#1F1E1D"/>
          </g>
        </svg>
      `
    },

    /* =========================================================================
       [5. 🪟 창밖 풍경 (window_view) — 상점 구매 10종 (2열 × 5줄, 전용 1슬롯 교체형)]
       ========================================================================= */
    {
      id: "view_sunny_clouds",
      name: "뭉게구름 맑은 날",
      shortName: "뭉게구름",
      category: "window_view",
      categoryLabel: "🪟 창밖",
      zoneLabel: "창밖 풍경",
      price: 50,
      boostPercent: 2,
      defaultOwned: false,
      defaultPlaced: false,
      recommendedSound: "birds",
      badge: "인기",
      description: "따사로운 햇살과 구름이 흐르는 하늘",
      reactionQuote: "따뜻한 햇살이 창가를 넘어 거실 바닥까지 쏟아져요 ☀️ (부스트 +2%)",
      cardBg: "#FCF2E4",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="thumbSunnyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#FAE2C6"/>
              <stop offset="65%" stop-color="#FDF0DC"/>
              <stop offset="100%" stop-color="#FEF8EC"/>
            </linearGradient>
          </defs>
          <rect x="24" y="14" width="52" height="52" rx="3" fill="url(#thumbSunnyGrad)" stroke="#1F1E1D" stroke-width="1.9"/>
          <circle cx="65" cy="24" r="6.5" fill="#F8C87A" stroke="#D97736" stroke-width="1.1"/>
          <line x1="59" y1="29" x2="36" y2="56" stroke="#F8D292" stroke-width="3.2" opacity="0.55" stroke-linecap="round"/>
          <line x1="65" y1="32" x2="48" y2="62" stroke="#F8D292" stroke-width="2.8" opacity="0.45" stroke-linecap="round"/>
          <path d="M31 36 C31 32, 36 31, 38 33 C40 29, 47 30, 48 34 C51 34, 52 38, 48 39 L32 39 C29 39, 29 36, 31 36 Z" fill="#FFFFFF" stroke="#1F1E1D" stroke-width="1.25" stroke-linejoin="round"/>
          <path d="M52 52 C52 49, 56 48, 58 50 C60 47, 65 48, 66 51 C68 51, 69 54, 66 55 L53 55 C51 55, 51 52, 52 52 Z" fill="#FFFFFF" stroke="#1F1E1D" stroke-width="1.15" stroke-linejoin="round"/>
          <line x1="50" y1="14" x2="50" y2="66" stroke="#1F1E1D" stroke-width="1.5"/>
          <line x1="24" y1="40" x2="76" y2="40" stroke="#1F1E1D" stroke-width="1.5"/>
        </svg>
      `
    },
    {
      id: "view_gentle_rain",
      name: "촉촉한 빗줄기",
      shortName: "촉촉한 비",
      category: "window_view",
      categoryLabel: "🪟 창밖",
      zoneLabel: "창밖 풍경",
      price: 70,
      boostPercent: 3,
      defaultOwned: false,
      defaultPlaced: false,
      recommendedSound: "rain",
      badge: "힐링",
      description: "차분한 연필 빗줄기가 사선으로 내려요",
      reactionQuote: "창밖으로 촉촉한 빗줄기가 사선으로 내려요 🌧️ (부스트 +3%)",
      cardBg: "#EEF2F5",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="24" y="14" width="52" height="52" rx="3" fill="#EAEFF2" stroke="#1F1E1D" stroke-width="1.9"/>
          <line x1="36" y1="20" x2="31" y2="33" stroke="#5A6973" stroke-width="1.35" stroke-linecap="round"/>
          <line x1="46" y1="22" x2="41" y2="35" stroke="#5A6973" stroke-width="1.35" stroke-linecap="round"/>
          <line x1="62" y1="19" x2="57" y2="32" stroke="#5A6973" stroke-width="1.35" stroke-linecap="round"/>
          <line x1="70" y1="26" x2="65" y2="38" stroke="#5A6973" stroke-width="1.35" stroke-linecap="round"/>
          <line x1="39" y1="45" x2="34" y2="58" stroke="#5A6973" stroke-width="1.35" stroke-linecap="round"/>
          <line x1="60" y1="46" x2="55" y2="59" stroke="#5A6973" stroke-width="1.35" stroke-linecap="round"/>
          <line x1="50" y1="14" x2="50" y2="66" stroke="#1F1E1D" stroke-width="1.5"/>
          <line x1="24" y1="40" x2="76" y2="40" stroke="#1F1E1D" stroke-width="1.5"/>
        </svg>
      `
    },
    {
      id: "view_cozy_snow",
      name: "포근한 함박눈",
      shortName: "함박눈",
      category: "window_view",
      categoryLabel: "🪟 창밖",
      zoneLabel: "창밖 풍경",
      price: 80,
      boostPercent: 4,
      defaultOwned: false,
      defaultPlaced: false,
      recommendedSound: "fire",
      badge: "겨울",
      description: "동글동글한 눈송이가 살랑이며 내려요",
      reactionQuote: "창밖으로 포근한 함박눈이 소복소복 내려요 ❄️ (부스트 +4%)",
      cardBg: "#EFF3F7",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="24" y="14" width="52" height="52" rx="3" fill="#E3EBF2" stroke="#1F1E1D" stroke-width="1.9"/>
          <circle cx="34" cy="24" r="2.6" fill="#FFFFFF" stroke="#7A8A99" stroke-width="0.9"/>
          <circle cx="43" cy="33" r="2.1" fill="#FFFFFF" stroke="#7A8A99" stroke-width="0.9"/>
          <circle cx="62" cy="25" r="2.8" fill="#FFFFFF" stroke="#7A8A99" stroke-width="0.9"/>
          <circle cx="68" cy="35" r="1.9" fill="#FFFFFF" stroke="#7A8A99" stroke-width="0.9"/>
          <circle cx="37" cy="52" r="2.5" fill="#FFFFFF" stroke="#7A8A99" stroke-width="0.9"/>
          <circle cx="61" cy="54" r="2.3" fill="#FFFFFF" stroke="#7A8A99" stroke-width="0.9"/>
          <line x1="50" y1="14" x2="50" y2="66" stroke="#1F1E1D" stroke-width="1.5"/>
          <line x1="24" y1="40" x2="76" y2="40" stroke="#1F1E1D" stroke-width="1.5"/>
        </svg>
      `
    },
    {
      id: "view_starry_night",
      name: "별빛 고요한 밤",
      shortName: "별빛 밤하늘",
      category: "window_view",
      categoryLabel: "🪟 창밖",
      zoneLabel: "창밖 풍경",
      price: 80,
      boostPercent: 4,
      defaultOwned: false,
      defaultPlaced: false,
      recommendedSound: "cricket",
      badge: "인기",
      description: "초승달과 작은 별이 반짝이는 밤하늘",
      reactionQuote: "은은한 먹색 밤하늘에 별빛이 반짝여요 🌙 (부스트 +4%)",
      cardBg: "#ECEAF0",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="24" y="14" width="52" height="52" rx="3" fill="#3A3A44" stroke="#1F1E1D" stroke-width="1.9"/>
          <path d="M62 21 C57 22, 56 29, 62 32 C58 31, 58 24, 62 21 Z" fill="#F6E2A8" stroke="#F6E2A8" stroke-width="1.2" stroke-linejoin="round"/>
          <circle cx="35" cy="25" r="1.4" fill="#FFF8DC"/>
          <circle cx="43" cy="31" r="1.1" fill="#FFF8DC"/>
          <circle cx="37" cy="51" r="1.3" fill="#FFF8DC"/>
          <circle cx="65" cy="52" r="1.2" fill="#FFF8DC"/>
          <path d="M32 34 L33 36 L35 37 L33 38 L32 40 L31 38 L29 37 L31 36 Z" fill="#F6E2A8"/>
          <line x1="50" y1="14" x2="50" y2="66" stroke="#1F1E1D" stroke-width="1.6"/>
          <line x1="24" y1="40" x2="76" y2="40" stroke="#1F1E1D" stroke-width="1.6"/>
        </svg>
      `
    },
    {
      id: "view_pink_dawn",
      name: "분홍빛 새벽 여명",
      shortName: "새벽 여명",
      category: "window_view",
      categoryLabel: "🪟 창밖",
      zoneLabel: "창밖 풍경",
      price: 85,
      boostPercent: 4,
      defaultOwned: false,
      defaultPlaced: false,
      recommendedSound: "birds",
      badge: "감성",
      description: "연핑크 하늘 위로 옅은 구름이 스쳐요",
      reactionQuote: "분홍빛과 살구빛이 어우러진 포근한 새벽이에요 🌅 (부스트 +4%)",
      cardBg: "#FBEFF0",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="thumbDawnGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#F6DADF"/>
              <stop offset="58%" stop-color="#FBE7D8"/>
              <stop offset="100%" stop-color="#FEF6E8"/>
            </linearGradient>
          </defs>
          <rect x="24" y="14" width="52" height="52" rx="3" fill="url(#thumbDawnGrad)" stroke="#1F1E1D" stroke-width="1.9"/>
          <path d="M30 31 Q37 27 44 31" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M55 27 Q63 24 70 28" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M35 53 Q46 49 58 53" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>
          <line x1="50" y1="14" x2="50" y2="66" stroke="#1F1E1D" stroke-width="1.5"/>
          <line x1="24" y1="40" x2="76" y2="40" stroke="#1F1E1D" stroke-width="1.5"/>
        </svg>
      `
    },
    {
      id: "view_summer_leaves",
      name: "초록빛 여름 잎새",
      shortName: "여름 잎새",
      category: "window_view",
      categoryLabel: "🪟 창밖",
      zoneLabel: "창밖 풍경",
      price: 85,
      boostPercent: 4,
      defaultOwned: false,
      defaultPlaced: false,
      recommendedSound: "wind",
      badge: "여름",
      description: "연초록 나뭇잎이 바람에 살랑여요",
      reactionQuote: "창가 모서리에 싱그러운 초록 잎새가 살랑여요 🌿 (부스트 +4%)",
      cardBg: "#EEF5EA",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="24" y="14" width="52" height="52" rx="3" fill="#F4F9F0" stroke="#1F1E1D" stroke-width="1.9"/>
          <path d="M25 18 Q36 22 43 32" stroke="#536B42" stroke-width="1.3" stroke-linecap="round"/>
          <ellipse cx="32" cy="23" rx="5.5" ry="3" transform="rotate(24 32 23)" fill="#C6DFB3" stroke="#1F1E1D" stroke-width="1.1"/>
          <ellipse cx="41" cy="29" rx="5" ry="2.7" transform="rotate(-14 41 29)" fill="#D6E9C5" stroke="#1F1E1D" stroke-width="1.1"/>
          <path d="M75 17 Q66 23 60 32" stroke="#536B42" stroke-width="1.3" stroke-linecap="round"/>
          <ellipse cx="68" cy="23" rx="5.5" ry="3" transform="rotate(-24 68 23)" fill="#C6DFB3" stroke="#1F1E1D" stroke-width="1.1"/>
          <ellipse cx="60" cy="30" rx="4.8" ry="2.5" transform="rotate(18 60 30)" fill="#D6E9C5" stroke="#1F1E1D" stroke-width="1.05"/>
          <line x1="50" y1="14" x2="50" y2="66" stroke="#1F1E1D" stroke-width="1.5"/>
          <line x1="24" y1="40" x2="76" y2="40" stroke="#1F1E1D" stroke-width="1.5"/>
        </svg>
      `
    },
    {
      id: "view_cherry_blossom",
      name: "살랑이는 벚꽃",
      shortName: "살랑 벚꽃",
      category: "window_view",
      categoryLabel: "🪟 창밖",
      zoneLabel: "창밖 풍경",
      price: 90,
      boostPercent: 4,
      defaultOwned: false,
      defaultPlaced: false,
      recommendedSound: "wind",
      badge: "봄날",
      description: "연핑크 벚꽃잎이 바람에 스쳐 지나가요",
      reactionQuote: "창밖으로 연분홍 벚꽃잎이 살랑이며 흩날려요 🌸 (부스트 +4%)",
      cardBg: "#FCF1F4",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="24" y="14" width="52" height="52" rx="3" fill="#FDF5F7" stroke="#1F1E1D" stroke-width="1.9"/>
          <ellipse cx="35" cy="25" rx="3.4" ry="2" transform="rotate(-24 35 25)" fill="#F4BDCB" stroke="#1F1E1D" stroke-width="1"/>
          <ellipse cx="44" cy="34" rx="2.8" ry="1.7" transform="rotate(18 44 34)" fill="#F7CBD6" stroke="#1F1E1D" stroke-width="0.95"/>
          <ellipse cx="63" cy="24" rx="3.3" ry="1.9" transform="rotate(-15 63 24)" fill="#F4BDCB" stroke="#1F1E1D" stroke-width="1"/>
          <ellipse cx="38" cy="52" rx="3.1" ry="1.8" transform="rotate(28 38 52)" fill="#F4BDCB" stroke="#1F1E1D" stroke-width="1"/>
          <ellipse cx="63" cy="53" rx="3.3" ry="1.9" transform="rotate(-22 63 53)" fill="#F7CBD6" stroke="#1F1E1D" stroke-width="1"/>
          <line x1="50" y1="14" x2="50" y2="66" stroke="#1F1E1D" stroke-width="1.5"/>
          <line x1="24" y1="40" x2="76" y2="40" stroke="#1F1E1D" stroke-width="1.5"/>
        </svg>
      `
    },
    {
      id: "view_autumn_sunset",
      name: "노을빛 가을 낙엽",
      shortName: "가을 노을",
      category: "window_view",
      categoryLabel: "🪟 창밖",
      zoneLabel: "창밖 풍경",
      price: 90,
      boostPercent: 4,
      defaultOwned: false,
      defaultPlaced: false,
      recommendedSound: "cricket",
      badge: "가을",
      description: "따뜻한 노을 하늘 위로 단풍잎이 내려요",
      reactionQuote: "노을빛 창밖으로 가을 단풍잎이 천천히 내려요 🍁 (부스트 +4%)",
      cardBg: "#FAF0E6",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="thumbAutumnGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#F5D3B3"/>
              <stop offset="62%" stop-color="#FAE6CC"/>
              <stop offset="100%" stop-color="#FEF4E4"/>
            </linearGradient>
          </defs>
          <rect x="24" y="14" width="52" height="52" rx="3" fill="url(#thumbAutumnGrad)" stroke="#1F1E1D" stroke-width="1.9"/>
          <path d="M36 22 L38 26 L35 28 L33 25 Z" fill="#D97736" stroke="#1F1E1D" stroke-width="1"/>
          <path d="M62 25 L65 29 L61 31 L59 27 Z" fill="#C95F38" stroke="#1F1E1D" stroke-width="1"/>
          <path d="M40 50 L43 54 L39 56 L37 52 Z" fill="#E39B4F" stroke="#1F1E1D" stroke-width="1"/>
          <path d="M63 51 L66 55 L62 57 L60 53 Z" fill="#D97736" stroke="#1F1E1D" stroke-width="1"/>
          <line x1="50" y1="14" x2="50" y2="66" stroke="#1F1E1D" stroke-width="1.5"/>
          <line x1="24" y1="40" x2="76" y2="40" stroke="#1F1E1D" stroke-width="1.5"/>
        </svg>
      `
    },
    {
      id: "view_after_rain_rainbow",
      name: "비 갠 뒤 무지개",
      shortName: "무지개 하늘",
      category: "window_view",
      categoryLabel: "🪟 창밖",
      zoneLabel: "창밖 풍경",
      price: 95,
      boostPercent: 5,
      defaultOwned: false,
      defaultPlaced: false,
      recommendedSound: "birds",
      badge: "스페셜",
      description: "파스텔 무지개 위로 뭉게구름이 흘러요",
      reactionQuote: "비 갠 하늘에 은은한 파스텔 무지개가 떴어요 🌈 (부스트 +5%)",
      cardBg: "#F3F6FA",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="24" y="14" width="52" height="52" rx="3" fill="#F2F7FB" stroke="#1F1E1D" stroke-width="1.9"/>
          <path d="M27 52 A24 24 0 0 1 73 52" stroke="#F0B9B9" stroke-width="3" fill="none"/>
          <path d="M30 52 A21 21 0 0 1 70 52" stroke="#F6D7A8" stroke-width="3" fill="none"/>
          <path d="M33 52 A18 18 0 0 1 67 52" stroke="#CBE0BC" stroke-width="3" fill="none"/>
          <path d="M36 52 A15 15 0 0 1 64 52" stroke="#BBD7EA" stroke-width="3" fill="none"/>
          <path d="M31 54 C31 51, 35 50, 37 52 C39 49, 44 50, 45 53 C47 53, 48 56, 45 57 L32 57 C30 57, 30 54, 31 54 Z" fill="#FFFFFF" stroke="#1F1E1D" stroke-width="1.15" stroke-linejoin="round"/>
          <line x1="50" y1="14" x2="50" y2="66" stroke="#1F1E1D" stroke-width="1.5"/>
          <line x1="24" y1="40" x2="76" y2="40" stroke="#1F1E1D" stroke-width="1.5"/>
        </svg>
      `
    },
    {
      id: "view_firefly_night",
      name: "반딧불이 여름밤",
      shortName: "반딧불이 밤",
      category: "window_view",
      categoryLabel: "🪟 창밖",
      zoneLabel: "창밖 풍경",
      price: 100,
      boostPercent: 5,
      defaultOwned: false,
      defaultPlaced: false,
      recommendedSound: "cricket",
      badge: "스페셜",
      description: "숲빛 밤하늘 위로 반딧불이가 떠다녀요",
      reactionQuote: "깊은 숲빛 여름밤에 노란 반딧불이가 반짝여요 ✨ (부스트 +5%)",
      cardBg: "#E6ECEA",
      svgThumb: `
        <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="24" y="14" width="52" height="52" rx="3" fill="#2A3835" stroke="#1F1E1D" stroke-width="1.9"/>
          <circle cx="36" cy="28" r="4" fill="#FDE68A" opacity="0.32"/>
          <circle cx="36" cy="28" r="1.8" fill="#FEF08A"/>
          <circle cx="62" cy="24" r="4.5" fill="#FDE68A" opacity="0.3"/>
          <circle cx="62" cy="24" r="1.9" fill="#FEF08A"/>
          <circle cx="42" cy="52" r="4.2" fill="#FDE68A" opacity="0.32"/>
          <circle cx="42" cy="52" r="1.8" fill="#FEF08A"/>
          <circle cx="65" cy="50" r="3.8" fill="#FDE68A" opacity="0.28"/>
          <circle cx="65" cy="50" r="1.6" fill="#FEF08A"/>
          <line x1="50" y1="14" x2="50" y2="66" stroke="#1F1E1D" stroke-width="1.6"/>
          <line x1="24" y1="40" x2="76" y2="40" stroke="#1F1E1D" stroke-width="1.6"/>
        </svg>
      `
    }
  ];

  function getItemById(id) {
    return ITEMS_CATALOG.find((item) => item.id === id) || null;
  }

  PetFocus.MAX_PLACED_SLOTS = MAX_PLACED_SLOTS;
  PetFocus.ABSOLUTE_MAX_SLOTS = ABSOLUTE_MAX_SLOTS;
  PetFocus.MAX_OWNED_PER_ITEM = MAX_OWNED_PER_ITEM;
  PetFocus.SLOT_EXPANSION_TIERS = SLOT_EXPANSION_TIERS;
  PetFocus.getMaxOwnedForItem = getMaxOwnedForItem;
  PetFocus.getPurchasePriceForItem = getPurchasePriceForItem;
  PetFocus.SHOP_CATEGORIES = SHOP_CATEGORIES;
  PetFocus.ITEMS_CATALOG = ITEMS_CATALOG;
  PetFocus.getItemById = getItemById;
  PetFocus.calculateRewardBreakdown = calculateRewardBreakdown;
  PetFocus.getTotalBoostPercent = getTotalBoostPercent;
})(window);
