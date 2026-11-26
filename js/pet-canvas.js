/**
 * 메인 거실 캔버스(SVG) & 상점 미니 프리뷰 & 폴라로이드 렌더러
 * - [사실적인 지상/창틀 연속 이동 & 방향 전환(Flip)]
 *   * 공중으로 붕 떴다가 떨어지는 어색한 이동을 제거하고 requestAnimationFrame 기반 연속 보행/비행 구현
 *   * 이동 방향(좌/우)에 맞춰 캐릭터 그래픽을 자연스럽게 좌우 반전(scaleX)하되, Zzz 텍스트는 뒤집히지 않도록 분리
 *   * 왕관앵무만 날갯짓과 함께 공중 비행 이동하며, 강아지·웰시코기·햄스터·거북이·고슴도치는 지상/창틀 선을 따라 실제로 발을 움직여 보행
 *   * 고양이 2종과 토끼는 평소 사뿐히 걷거나 낮게 깡총거리며, 창틀·버튼으로 오르내릴 때만 잠깐 웅크린 뒤(crouch) 자연스럽게 점프 착지
 * - [5단계 다채로운 행동 상태 머신 (walk/run, idle, play, rest, react)]
 *   * 3~8초마다 걷기/달리기, 호흡·눈깜빡임 대기(idle), 동물별 장난/탐색(play), 눈 감고 휴식(rest), 클릭 애교(react) 상태를 자연스럽게 순환
 */
(function (global) {
  const PetFocus = (global.PetFocus = global.PetFocus || {});
  const { audioEngine, getItemById, appStorage } = PetFocus;

  const VIEWBOX_MIN_X = 0;
  const VIEWBOX_MIN_Y = -45;
  const VIEWBOX_W = 380;
  const VIEWBOX_H = 560; // y 범위: -45 ~ 515
  const WINDOW_TOP_Y = 24;
  const WINDOW_MID_Y = 92;
  const WINDOW_SILL_Y = 160;
  const FLOOR_MIN_Y = 188;

  // 동물별 이동/휴식 영역 분류
  const GROUND_ONLY_PETS = new Set([
    "living_room_dog",
    "welsh_corgi",
    "white_rabbit",
    "little_turtle",
    "hedgehog_friend"
  ]);
  const CLIMBER_PETS = new Set([
    "window_cat",
    "tuxedo_cat",
    "hamster_friend"
  ]);
  const ALL_LIVING_PETS = new Set([
    ...GROUND_ONLY_PETS,
    ...CLIMBER_PETS,
    "cockatiel_bird"
  ]);

  /**
   * 4분할 창문의 3단 가로 창틀 라인 정의 (① 맨 윗틀 y=24, ② 가운데 가로창살 y=92, ③ 아래 창틀·선반 y=160)
   * - 거실 바닥 공간을 넓히기 위해 기존 대비 30px(약 5.4%) 상향 조정
   * - minX/maxX를 실제 창틀 선(122~258 / 24~356) 안쪽으로 정밀 보정해 창틀 바깥 허공에 걸치지 않도록 함
   */
  const WINDOW_HORIZONTAL_BARS = [
    {
      y: WINDOW_SILL_Y,
      minX: 30,
      maxX: 350,
      walkMinX: 38,
      walkMaxX: 342,
      guideX1: 24,
      guideX2: 356,
      threshold: 16,
      label: "하단 창틀·선반"
    },
    {
      y: WINDOW_MID_Y,
      minX: 124,
      maxX: 256,
      walkMinX: 134,
      walkMaxX: 246,
      guideX1: 122,
      guideX2: 258,
      threshold: 16,
      label: "중간 가로 창틀"
    },
    {
      y: WINDOW_TOP_Y,
      minX: 124,
      maxX: 256,
      walkMinX: 134,
      walkMaxX: 246,
      guideX1: 122,
      guideX2: 258,
      threshold: 16,
      label: "상단 가로 창틀"
    }
  ];

  // 창틀 자석 스냅 허용 목록 (지상 전용 동물 5종은 제외하고 고양이·햄스터·왕관앵무 및 소품만 창틀 스냅 허용)
  const SILL_SNAP_ENABLED_ITEMS = new Set([
    "window_cat",
    "hamster_friend",
    "cockatiel_bird",
    "tuxedo_cat",
    "goldfish_bowl",
    "monstera_pot",
    "wall_clock",
    "mini_bookshelf",
    "tennis_ball",
    "yarn_ball",
    "wooden_bird_perch",
    "yellow_duck_toy",
    "hamster_wheel",
    "crescent_mood_lamp",
    "mushroom_stand_lamp",
    "mini_cactus_pot",
    "tulip_glass_vase",
    "aroma_candle",
    "mini_desk_calendar",
    "sparkle_snow_globe"
  ]);

  const ITEM_BOTTOM_OFFSET = {
    monstera_pot: 0,
    window_cat: 0,
    hamster_friend: 1,
    cockatiel_bird: 1.5,
    tuxedo_cat: 0,
    welsh_corgi: 0,
    little_turtle: 0,
    hedgehog_friend: 0,
    white_rabbit: 0,
    goldfish_bowl: 0,
    living_room_dog: 17,
    wall_clock: 18,
    mini_bookshelf: 7,
    tennis_ball: 10.5,
    yarn_ball: 11,
    wooden_bird_perch: 0,
    yellow_duck_toy: 0,
    hamster_wheel: 0,
    crescent_mood_lamp: 0,
    mushroom_stand_lamp: 0,
    mini_cactus_pot: 0,
    tulip_glass_vase: 0,
    aroma_candle: 0,
    mini_desk_calendar: 0,
    sparkle_snow_globe: 0
  };

  const ITEM_LOCAL_BBOX = {
    living_room_dog:     { top: 36, bottom: 23, left: 30, right: 35 },
    window_cat:          { top: 44, bottom: 19, left: 30, right: 33 },
    hamster_friend:      { top: 28, bottom: 5,  left: 15, right: 15 },
    cockatiel_bird:      { top: 46, bottom: 8,  left: 20, right: 20 },
    tuxedo_cat:          { top: 36, bottom: 6,  left: 24, right: 31 },
    welsh_corgi:         { top: 38, bottom: 6,  left: 27, right: 31 },
    little_turtle:       { top: 20, bottom: 5,  left: 25, right: 25 },
    hedgehog_friend:     { top: 26, bottom: 5,  left: 22, right: 23 },
    white_rabbit:        { top: 40, bottom: 5,  left: 21, right: 21 },
    goldfish_bowl:       { top: 36, bottom: 4,  left: 23, right: 23 },
    monstera_pot:        { top: 68, bottom: 4,  left: 20, right: 20 },
    wall_clock:          { top: 21, bottom: 21, left: 21, right: 21 },
    mini_bookshelf:      { top: 33, bottom: 10, left: 25, right: 25 },
    stand_lamp:          { top: 52, bottom: 53, left: 23, right: 23 },
    // wall_wood_branch는 앵무새(top: 46)가 윗면(y=-4)에 올라앉을 때 볏이 화면 상단에 걸리지 않도록 top 여유를 52로 설정
    wall_wood_branch:    { top: 52, bottom: 22, left: 36, right: 36 },
    beige_cushion:       { top: 20, bottom: 20, left: 50, right: 50 },
    ceramic_bowl:        { top: 16, bottom: 13, left: 19, right: 19 },
    tennis_ball:         { top: 24, bottom: 13, left: 13, right: 13 },
    yarn_ball:           { top: 14, bottom: 14, left: 14, right: 23 },
    wooden_bird_perch:   { top: 56, bottom: 4,  left: 25, right: 25 },
    mini_cat_tower:      { top: 100, bottom: 4, left: 38, right: 38 },
    cozy_tent_house:     { top: 64, bottom: 4,  left: 33, right: 33 },
    yellow_duck_toy:     { top: 24, bottom: 4,  left: 16, right: 17 },
    hamster_wheel:       { top: 52, bottom: 4,  left: 24, right: 24 },
    cloud_wall_lamp:     { top: 18, bottom: 14, left: 24, right: 24 },
    crescent_mood_lamp:  { top: 32, bottom: 4,  left: 15, right: 15 },
    mushroom_stand_lamp: { top: 28, bottom: 4,  left: 18, right: 18 },
    starlight_garland:   { top: 12, bottom: 20, left: 38, right: 38 },
    cozy_single_sofa:    { top: 48, bottom: 4,  left: 34, right: 34 },
    wooden_tea_table:    { top: 32, bottom: 4,  left: 25, right: 25 },
    vintage_turntable:   { top: 30, bottom: 4,  left: 23, right: 23 },
    rattan_basket:       { top: 25, bottom: 4,  left: 18, right: 18 },
    mini_cactus_pot:     { top: 40, bottom: 4,  left: 14, right: 14 },
    tulip_glass_vase:    { top: 40, bottom: 4,  left: 14, right: 14 },
    hanging_plant:       { top: 28, bottom: 24, left: 15, right: 15 },
    croquis_frame:       { top: 22, bottom: 16, left: 20, right: 20 },
    aroma_candle:        { top: 30, bottom: 4,  left: 12, right: 12 },
    cozy_dreamcatcher:   { top: 24, bottom: 29, left: 14, right: 14 },
    mini_desk_calendar:  { top: 27, bottom: 4,  left: 16, right: 17 },
    sparkle_snow_globe:  { top: 34, bottom: 4,  left: 16, right: 16 }
  };

  /**
   * 각 동물의 기본 그래픽이 바라보는 방향 (+1: 오른쪽, -1: 왼쪽)
   * 왼쪽으로 갈 때와 오른쪽으로 갈 때 진행 방향을 정확히 바라보도록 scaleX 계산에 사용합니다.
   */
  const NATURAL_FACING_DIR = {
    living_room_dog: 1,
    welsh_corgi: 1,
    little_turtle: 1,
    hedgehog_friend: 1,
    white_rabbit: 1,
    hamster_friend: 1,
    window_cat: -1,
    tuxedo_cat: -1,
    cockatiel_bird: -1
  };

  const LIGHT_ITEM_IDS = [
    "stand_lamp",
    "cloud_wall_lamp",
    "crescent_mood_lamp",
    "mushroom_stand_lamp",
    "starlight_garland",
    "aroma_candle"
  ];

  const ALL_PROP_IDS = [
    // 바닥/가구/데코 레이어 (동물들보다 뒤에 렌더링되어 동물이 가구/방석/캣타워/나뭇가지/쳇바퀴 앞쪽에 자연스럽게 올라타 보이도록 정렬)
    "beige_cushion",
    "cozy_single_sofa",
    "wooden_tea_table",
    "mini_cat_tower",
    "cozy_tent_house",
    "rattan_basket",
    "wooden_bird_perch",
    "wall_wood_branch",
    "monstera_pot",
    "mini_cactus_pot",
    "tulip_glass_vase",
    "hanging_plant",
    "wall_clock",
    "croquis_frame",
    "cozy_dreamcatcher",
    "mini_bookshelf",
    "vintage_turntable",
    "stand_lamp",
    "cloud_wall_lamp",
    "crescent_mood_lamp",
    "mushroom_stand_lamp",
    "starlight_garland",
    "aroma_candle",
    "mini_desk_calendar",
    "sparkle_snow_globe",
    "ceramic_bowl",
    "hamster_wheel",
    "tennis_ball",
    "yarn_ball",
    "yellow_duck_toy",
    // 동물 레이어 (항상 소품/가구 앞쪽에 렌더링)
    "goldfish_bowl",
    "little_turtle",
    "hedgehog_friend",
    "white_rabbit",
    "welsh_corgi",
    "tuxedo_cat",
    "window_cat",
    "hamster_friend",
    "cockatiel_bird"
  ];

  const DOG_QUOTES_IDLE = [
    "멍! 오늘도 기분 좋게 집중해 봐요 🐾",
    "쓰담쓰담 해줘서 고마워요 ✨ (부스트 +5%)",
    "꼬리 살랑살랑~ 언제나 응원할게요! 🦴"
  ];

  const DOG_QUOTES_FOCUS = [
    "새근새근... 옆에서 조용히 응원 중 💤",
    "쉿, 지금 아주 잘하고 있어요 🍃",
    "포근하게 졸면서 기다릴게요 🐾"
  ];

  const CAT_QUOTES = [
    "골골골... 햇살이 제일 따스해 🐱 (부스트 +5%)",
    "야옹~ 사뿐사뿐 산책하고 그루밍 중 ☀️",
    "창가 바람이 솔솔 불어와요 🍃"
  ];

  const WINDOW_VIEW_IDS = [
    "view_sunny_clouds",
    "view_gentle_rain",
    "view_cozy_snow",
    "view_starry_night",
    "view_pink_dawn",
    "view_summer_leaves",
    "view_cherry_blossom",
    "view_autumn_sunset",
    "view_after_rain_rainbow",
    "view_firefly_night"
  ];

  function getActiveWindowViewFromPlaced(placedIds) {
    if (appStorage && typeof appStorage.getActiveWindowViewId === "function") {
      return appStorage.getActiveWindowViewId();
    }
    if (!placedIds) return null;
    for (const id of placedIds) {
      if (WINDOW_VIEW_IDS.includes(id)) return id;
    }
    return null;
  }

  /**
   * 1번 '뭉게구름 맑은 날' 전용: 창살을 넘어 거실 바닥으로 길게 쫙 비추는 은은한 햇살 내림 효과
   * (가구·동물 뒤에 배치되고 아주 은은한 투명도로 방 안 오브젝트를 가리지 않음)
   */
  function getWindowSunbeamOverlayMarkup(viewId, prefix = "", animated = true) {
    if (viewId !== "view_sunny_clouds") return "";
    const yTop = WINDOW_TOP_Y;
    const yMid = WINDOW_MID_Y;
    const yBot = WINDOW_SILL_Y;
    return `
      <defs>
        <linearGradient id="${prefix}roomSunbeamGrad" x1="0.82" y1="0" x2="0.18" y2="1">
          <stop offset="0%" stop-color="#FFD98E" stop-opacity="0.34"/>
          <stop offset="48%" stop-color="#FFE6B0" stop-opacity="0.16"/>
          <stop offset="100%" stop-color="#FEF9F1" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <g opacity="0.82" style="pointer-events:none;">
        <!-- 창문 전체에서 바닥 왼쪽 사선으로 부드럽게 쏟아지는 메인 햇살 -->
        <polygon points="122,${yBot} 258,${yBot} 166,392 18,358" fill="url(#${prefix}roomSunbeamGrad)">
          ${animated ? '<animate attributeName="opacity" values="0.72;1;0.72" dur="5.8s" repeatCount="indefinite"/>' : ""}
        </polygon>
        <!-- 창살 사이로 갈라져 내려오는 은은한 빛갈림 2줄기 -->
        <polygon points="126,${yMid + 4} 186,${yMid + 4} 96,356 32,334" fill="url(#${prefix}roomSunbeamGrad)" opacity="0.52"/>
        <polygon points="194,${yTop + 12} 254,${yTop + 12} 174,372 114,350" fill="url(#${prefix}roomSunbeamGrad)" opacity="0.48"/>
      </g>
    `;
  }

  /**
   * 4각 창문 유리 안쪽(x: 122..258, y: WINDOW_TOP_Y..WINDOW_SILL_Y)에만 마스킹되는 창밖 풍경 SVG 생성기
   * - 네이티브 SVG <animateTransform> / <animate> 무한 루프로 메인 거실, 상점 프리뷰, 그림일기 프리뷰 모두에서 끊김 없이 실시간 동작
   */
  function getWindowViewSVGMarkup(viewId, prefix = "", animated = true) {
    const x = 122;
    const y = WINDOW_TOP_Y;
    const w = 136;
    const h = 136;

    switch (viewId) {
      case "view_starry_night":
        return `
          <defs>
            <linearGradient id="${prefix}wvNightGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#2D2F3A"/>
              <stop offset="65%" stop-color="#3E4150"/>
              <stop offset="100%" stop-color="#525566"/>
            </linearGradient>
          </defs>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${prefix}wvNightGrad)" />
          <!-- 초승달 + 은은한 달빛 반짝임 -->
          <g>
            <circle cx="226" cy="${y + 29}" r="14" fill="#F6E2A8" opacity="0.16">
              ${animated ? '<animate attributeName="opacity" values="0.12;0.28;0.12" dur="4.2s" repeatCount="indefinite"/>' : ""}
            </circle>
            <path d="M231 ${y + 18} C220 ${y + 20}, 218 ${y + 34}, 231 ${y + 40} C223 ${y + 37}, 223 ${y + 23}, 231 ${y + 18} Z" fill="#F6E2A8" stroke="#F6E2A8" stroke-width="1.1" stroke-linejoin="round">
              ${animated ? '<animate attributeName="opacity" values="0.88;1;0.88" dur="4.2s" repeatCount="indefinite"/>' : ""}
            </path>
          </g>
          <!-- 서로 다른 주기로 은은하게 반짝이는 별들 -->
          <g transform="translate(148, ${y + 30})">
            <path d="M0 -5.5 L1.6 -1.6 L5.5 0 L1.6 1.6 L0 5.5 L-1.6 1.6 L-5.5 0 L-1.6 -1.6 Z" fill="#F8E9B8">
              ${animated ? '<animate attributeName="opacity" values="0.3;1;0.3" dur="2.6s" begin="-0.4s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="scale" values="0.82;1.15;0.82" dur="2.6s" begin="-0.4s" repeatCount="indefinite"/>' : ""}
            </path>
          </g>
          <g transform="translate(226, ${y + 88})">
            <path d="M0 -4.5 L1.3 -1.3 L4.5 0 L1.3 1.3 L0 4.5 L-1.3 1.3 L-4.5 0 L-1.3 -1.3 Z" fill="#FFF8E2">
              ${animated ? '<animate attributeName="opacity" values="0.25;1;0.25" dur="3.4s" begin="-1.6s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="scale" values="0.8;1.16;0.8" dur="3.4s" begin="-1.6s" repeatCount="indefinite"/>' : ""}
            </path>
          </g>
          <g transform="translate(164, ${y + 98})">
            <path d="M0 -3.8 L1.1 -1.1 L3.8 0 L1.1 1.1 L0 3.8 L-1.1 1.1 L-3.8 0 L-1.1 -1.1 Z" fill="#F8E9B8">
              ${animated ? '<animate attributeName="opacity" values="0.28;0.95;0.28" dur="3.9s" begin="-2.3s" repeatCount="indefinite"/>' : ""}
            </path>
          </g>
          <circle cx="174" cy="${y + 44}" r="1.4" fill="#FFF8E2">
            ${animated ? '<animate attributeName="opacity" values="0.2;1;0.2" dur="2.3s" begin="-1.1s" repeatCount="indefinite"/>' : ""}
          </circle>
          <circle cx="138" cy="${y + 62}" r="1.2" fill="#F8E9B8">
            ${animated ? '<animate attributeName="opacity" values="0.25;0.95;0.25" dur="3.1s" begin="-0.7s" repeatCount="indefinite"/>' : ""}
          </circle>
          <circle cx="208" cy="${y + 54}" r="1.5" fill="#FFF8E2">
            ${animated ? '<animate attributeName="opacity" values="0.2;1;0.2" dur="2.8s" begin="-2.0s" repeatCount="indefinite"/>' : ""}
          </circle>
          <circle cx="144" cy="${y + 110}" r="1.3" fill="#FFF8E2">
            ${animated ? '<animate attributeName="opacity" values="0.22;0.95;0.22" dur="3.6s" begin="-1.4s" repeatCount="indefinite"/>' : ""}
          </circle>
          <circle cx="240" cy="${y + 112}" r="1.5" fill="#F8E9B8">
            ${animated ? '<animate attributeName="opacity" values="0.25;1;0.25" dur="2.9s" begin="-0.3s" repeatCount="indefinite"/>' : ""}
          </circle>
          <circle cx="196" cy="${y + 24}" r="1.1" fill="#FFF8E2">
            ${animated ? '<animate attributeName="opacity" values="0.18;0.9;0.18" dur="4.1s" begin="-2.8s" repeatCount="indefinite"/>' : ""}
          </circle>
          <path d="M122 ${y + 123} Q158 ${y + 113} 194 ${y + 121} T258 ${y + 119} L258 ${y + 136} L122 ${y + 136} Z" fill="#252730" opacity="0.58" />
        `;

      case "view_pink_dawn":
        return `
          <defs>
            <linearGradient id="${prefix}wvDawnGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#F4D6DD"/>
              <stop offset="52%" stop-color="#FBE5D5"/>
              <stop offset="100%" stop-color="#FEF6E9"/>
            </linearGradient>
            <radialGradient id="${prefix}wvDawnGlow" cx="68%" cy="82%" r="65%">
              <stop offset="0%" stop-color="#FFE7C2" stop-opacity="0.85"/>
              <stop offset="60%" stop-color="#FAD4D8" stop-opacity="0.35"/>
              <stop offset="100%" stop-color="#FEF6E9" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${prefix}wvDawnGrad)" />
          <!-- 하늘빛이 은은하게 숨 쉬듯 일렁이는 여명 빛 -->
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${prefix}wvDawnGlow)" opacity="0.45">
            ${animated ? '<animate attributeName="opacity" values="0.18;0.62;0.18" dur="6.4s" repeatCount="indefinite"/>' : ""}
          </rect>
          <circle cx="216" cy="${y + 112}" r="17" fill="#FFF1D0" opacity="0.72">
            ${animated ? '<animate attributeName="opacity" values="0.58;0.88;0.58" dur="6.4s" repeatCount="indefinite"/>' : ""}
          </circle>
          <!-- 옅은 새벽구름 3개가 왼쪽 -> 오른쪽으로 끊임없이 흘러감 -->
          <g transform="translate(${x}, ${y + 34})">
            <path d="M0 4 C0 -1, 9 -3, 13 1 C18 -5, 31 -3, 33 4 C38 4, 39 9, 33 10 L2 10 C-3 10, -3 4, 0 4 Z" fill="#FFFFFF" fill-opacity="0.82" stroke="#D8B8BA" stroke-width="0.9">
              ${animated ? '<animateTransform attributeName="transform" type="translate" from="-46 0" to="152 0" dur="22s" begin="-6s" repeatCount="indefinite"/>' : 'transform="translate(18, 0)"'}
            </path>
          </g>
          <g transform="translate(${x}, ${y + 66})">
            <path d="M0 3 Q14 -3 30 3" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.74">
              ${animated ? '<animateTransform attributeName="transform" type="translate" from="-38 0" to="150 0" dur="18s" begin="-11s" repeatCount="indefinite"/>' : 'transform="translate(82, 0)"'}
            </path>
          </g>
          <g transform="translate(${x}, ${y + 94})">
            <path d="M0 3 C0 -1, 8 -2, 12 1 C17 -4, 27 -2, 29 3 C33 3, 34 7, 29 8 L2 8 C-2 8, -2 3, 0 3 Z" fill="#FFFFFF" fill-opacity="0.78" stroke="#E2C7BD" stroke-width="0.85">
              ${animated ? '<animateTransform attributeName="transform" type="translate" from="-42 0" to="150 0" dur="26s" begin="-17s" repeatCount="indefinite"/>' : 'transform="translate(46, 0)"'}
            </path>
          </g>
        `;

      case "view_gentle_rain": {
        const rainDrops = `
          <line x1="12" y1="6" x2="4" y2="28"/>
          <line x1="36" y1="18" x2="28" y2="42"/>
          <line x1="62" y1="4" x2="54" y2="26"/>
          <line x1="88" y1="22" x2="80" y2="46"/>
          <line x1="114" y1="10" x2="106" y2="34"/>
          <line x1="132" y1="26" x2="124" y2="48"/>
          <line x1="22" y1="54" x2="14" y2="78"/>
          <line x1="48" y1="66" x2="40" y2="90"/>
          <line x1="74" y1="52" x2="66" y2="74"/>
          <line x1="102" y1="64" x2="94" y2="88"/>
          <line x1="126" y1="58" x2="118" y2="82"/>
          <line x1="14" y1="100" x2="6" y2="124"/>
          <line x1="42" y1="108" x2="34" y2="132"/>
          <line x1="68" y1="96" x2="60" y2="120"/>
          <line x1="96" y1="106" x2="88" y2="130"/>
          <line x1="122" y1="98" x2="114" y2="122"/>
        `;
        return `
          <defs>
            <linearGradient id="${prefix}wvRainGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#E2E9EE"/>
              <stop offset="100%" stop-color="#F1F4F4"/>
            </linearGradient>
          </defs>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${prefix}wvRainGrad)" />
          <!-- 2장의 타일 빗줄기 시트가 사선으로 끊김 없이 무한 낙하 -->
          <g transform="translate(${x}, ${y})" stroke="#5F6E78" stroke-width="1.15" stroke-linecap="round" opacity="0.68">
            <g>
              ${rainDrops}
              ${animated ? '<animateTransform attributeName="transform" type="translate" from="24 -136" to="-24 136" dur="1.55s" repeatCount="indefinite"/>' : ""}
            </g>
            ${
              animated
                ? `<g>
                    ${rainDrops}
                    <animateTransform attributeName="transform" type="translate" from="24 -136" to="-24 136" dur="1.55s" begin="-0.775s" repeatCount="indefinite"/>
                  </g>`
                : ""
            }
          </g>
        `;
      }

      case "view_cozy_snow": {
        const flakes = [
          { xOff: 18, r: 3.1, dur: 7.4, begin: -1.2, sway: 7, swayDur: 3.2 },
          { xOff: 42, r: 2.2, dur: 8.8, begin: -5.4, sway: -6, swayDur: 3.8 },
          { xOff: 66, r: 2.9, dur: 6.9, begin: -2.9, sway: 8, swayDur: 3.4 },
          { xOff: 90, r: 2.0, dur: 9.4, begin: -7.1, sway: -7, swayDur: 4.1 },
          { xOff: 112, r: 3.2, dur: 7.8, begin: -4.2, sway: 6, swayDur: 3.5 },
          { xOff: 28, r: 2.4, dur: 8.2, begin: -6.3, sway: -8, swayDur: 3.9 },
          { xOff: 54, r: 1.9, dur: 9.6, begin: -0.8, sway: 5, swayDur: 4.3 },
          { xOff: 80, r: 2.7, dur: 7.1, begin: -4.9, sway: -6, swayDur: 3.1 },
          { xOff: 124, r: 2.3, dur: 8.5, begin: -2.2, sway: 7, swayDur: 3.7 }
        ];
        const flakesMarkup = flakes
          .map((f, idx) => {
            const staticY = 18 + ((idx * 29) % 104);
            return `
              <g transform="translate(${x + f.xOff}, ${y})">
                <g>
                  <circle cx="0" cy="${animated ? 0 : staticY}" r="${f.r}" fill="#FFFFFF" stroke="#8594A1" stroke-width="0.8">
                    ${animated ? `<animateTransform attributeName="transform" type="translate" values="${-f.sway} 0; ${f.sway} 0; ${-f.sway} 0" dur="${f.swayDur}s" begin="${f.begin}s" repeatCount="indefinite"/>` : ""}
                  </circle>
                  ${animated ? `<animateTransform attributeName="transform" type="translate" from="0 -14" to="0 150" dur="${f.dur}s" begin="${f.begin}s" repeatCount="indefinite"/>` : ""}
                </g>
              </g>
            `;
          })
          .join("");
        return `
          <defs>
            <linearGradient id="${prefix}wvSnowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#DFE8F0"/>
              <stop offset="100%" stop-color="#F2F6FA"/>
            </linearGradient>
          </defs>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${prefix}wvSnowGrad)" />
          ${flakesMarkup}
        `;
      }

      case "view_cherry_blossom": {
        const petals = [
          { startX: -12, endX: 92, rx: 4.2, ry: 2.2, dur: 6.2, begin: -1.0, fill: "#F4BDCB" },
          { startX: 20, endX: 138, rx: 3.6, ry: 2.0, dur: 7.4, begin: -4.2, fill: "#F7CBD6" },
          { startX: 52, endX: 156, rx: 4.0, ry: 2.2, dur: 6.8, begin: -2.6, fill: "#F4BDCB" },
          { startX: -18, endX: 74, rx: 3.5, ry: 1.9, dur: 7.9, begin: -5.5, fill: "#F7CBD6" },
          { startX: 78, endX: 162, rx: 3.9, ry: 2.1, dur: 5.9, begin: -3.1, fill: "#F4BDCB" },
          { startX: 8, endX: 118, rx: 3.7, ry: 2.0, dur: 7.1, begin: -6.1, fill: "#F7CBD6" },
          { startX: 38, endX: 146, rx: 4.1, ry: 2.2, dur: 6.5, begin: -0.4, fill: "#F4BDCB" }
        ];
        const petalsMarkup = petals
          .map((p, idx) => {
            const staticX = 22 + ((idx * 31) % 98);
            const staticY = 20 + ((idx * 27) % 102);
            return `
              <g transform="translate(${x}, ${y})">
                <g ${animated ? "" : `transform="translate(${staticX}, ${staticY})"`}>
                  <ellipse cx="0" cy="0" rx="${p.rx}" ry="${p.ry}" fill="${p.fill}" stroke="#1F1E1D" stroke-width="0.85">
                    ${animated ? `<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="${(p.dur * 0.72).toFixed(1)}s" begin="${p.begin}s" repeatCount="indefinite"/>` : `transform="rotate(${idx % 2 === 0 ? -22 : 24})"`}
                  </ellipse>
                  ${animated ? `<animateTransform attributeName="transform" type="translate" from="${p.startX} -14" to="${p.endX} 150" dur="${p.dur}s" begin="${p.begin}s" repeatCount="indefinite"/>` : ""}
                </g>
              </g>
            `;
          })
          .join("");
        return `
          <defs>
            <linearGradient id="${prefix}wvBlossomGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#FDF1F4"/>
              <stop offset="100%" stop-color="#FEF9F5"/>
            </linearGradient>
          </defs>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${prefix}wvBlossomGrad)" />
          ${petalsMarkup}
        `;
      }

      case "view_autumn_sunset": {
        const leaves = [
          { xOff: 22, dur: 6.8, begin: -1.1, sway: 9, fill: "#D97736" },
          { xOff: 52, dur: 7.9, begin: -4.8, sway: -8, fill: "#C95F38" },
          { xOff: 84, dur: 6.4, begin: -2.4, sway: 10, fill: "#E39B4F" },
          { xOff: 112, dur: 8.3, begin: -6.2, sway: -9, fill: "#D97736" },
          { xOff: 36, dur: 7.4, begin: -3.5, sway: 8, fill: "#E39B4F" },
          { xOff: 98, dur: 7.1, begin: -0.6, sway: -7, fill: "#C95F38" },
          { xOff: 68, dur: 8.6, begin: -5.9, sway: 9, fill: "#D97736" }
        ];
        const leavesMarkup = leaves
          .map((l, idx) => {
            const staticY = 22 + ((idx * 26) % 98);
            return `
              <g transform="translate(${x + l.xOff}, ${y})">
                <g ${animated ? "" : `transform="translate(0, ${staticY})"`}>
                  <g>
                    <path d="M0 -5 L4 0 L0 5 L-4 0 Z" fill="${l.fill}" stroke="#1F1E1D" stroke-width="0.9" stroke-linejoin="round">
                      ${animated ? `<animateTransform attributeName="transform" type="rotate" values="-28; 28; -28" dur="3.4s" begin="${l.begin}s" repeatCount="indefinite"/>` : ""}
                    </path>
                    ${animated ? `<animateTransform attributeName="transform" type="translate" values="${-l.sway} 0; ${l.sway} 0; ${-l.sway} 0" dur="3.4s" begin="${l.begin}s" repeatCount="indefinite"/>` : ""}
                  </g>
                  ${animated ? `<animateTransform attributeName="transform" type="translate" from="0 -14" to="0 150" dur="${l.dur}s" begin="${l.begin}s" repeatCount="indefinite"/>` : ""}
                </g>
              </g>
            `;
          })
          .join("");
        return `
          <defs>
            <linearGradient id="${prefix}wvAutumnGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#F2CFAF"/>
              <stop offset="56%" stop-color="#FAE4C9"/>
              <stop offset="100%" stop-color="#FEF4E5"/>
            </linearGradient>
          </defs>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${prefix}wvAutumnGrad)" />
          <circle cx="164" cy="${y + 112}" r="18" fill="#FBEAC8" opacity="0.72">
            ${animated ? '<animate attributeName="opacity" values="0.6;0.85;0.6" dur="6s" repeatCount="indefinite"/>' : ""}
          </circle>
          ${leavesMarkup}
        `;
      }

      case "view_summer_leaves":
        return `
          <defs>
            <linearGradient id="${prefix}wvSummerGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#EEF6E8"/>
              <stop offset="65%" stop-color="#F7FAF2"/>
              <stop offset="100%" stop-color="#FCFBF5"/>
            </linearGradient>
            <radialGradient id="${prefix}wvLeafSun" cx="50%" cy="22%" r="60%">
              <stop offset="0%" stop-color="#FFF2BD" stop-opacity="0.55"/>
              <stop offset="100%" stop-color="#F7FAF2" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${prefix}wvSummerGrad)" />
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${prefix}wvLeafSun)" opacity="0.55">
            ${animated ? '<animate attributeName="opacity" values="0.32;0.75;0.32" dur="5.2s" repeatCount="indefinite"/>' : ""}
          </rect>
          <!-- 좌측 상단 모서리 연초록 잎새 가지 -->
          <g transform="translate(${x}, ${y})">
            <g>
              <path d="M-2 6 Q24 16 42 42" fill="none" stroke="#536B42" stroke-width="1.35" stroke-linecap="round"/>
              <ellipse cx="14" cy="14" rx="10" ry="5.2" transform="rotate(24 14 14)" fill="#C6DFB3" stroke="#1F1E1D" stroke-width="1.15"/>
              <ellipse cx="28" cy="24" rx="9.5" ry="4.8" transform="rotate(-14 28 24)" fill="#D6E9C5" stroke="#1F1E1D" stroke-width="1.1"/>
              <ellipse cx="12" cy="28" rx="8.5" ry="4.4" transform="rotate(42 12 28)" fill="#D6E9C5" stroke="#1F1E1D" stroke-width="1.05"/>
              <ellipse cx="38" cy="38" rx="8.5" ry="4.3" transform="rotate(18 38 38)" fill="#C6DFB3" stroke="#1F1E1D" stroke-width="1.05"/>
              ${animated ? '<animateTransform attributeName="transform" type="rotate" values="-4 0 0; 5 0 0; -4 0 0" dur="4.6s" repeatCount="indefinite"/>' : ""}
            </g>
          </g>
          <!-- 우측 상단 모서리 연초록 잎새 가지 -->
          <g transform="translate(${x + w}, ${y})">
            <g>
              <path d="M2 8 Q-24 18 -40 44" fill="none" stroke="#536B42" stroke-width="1.35" stroke-linecap="round"/>
              <ellipse cx="-15" cy="15" rx="10" ry="5.2" transform="rotate(-24 -15 15)" fill="#C6DFB3" stroke="#1F1E1D" stroke-width="1.15"/>
              <ellipse cx="-29" cy="26" rx="9" ry="4.6" transform="rotate(18 -29 26)" fill="#D6E9C5" stroke="#1F1E1D" stroke-width="1.1"/>
              <ellipse cx="-14" cy="31" rx="8.2" ry="4.2" transform="rotate(-38 -14 31)" fill="#D6E9C5" stroke="#1F1E1D" stroke-width="1.05"/>
              <ellipse cx="-38" cy="41" rx="8" ry="4.1" transform="rotate(-16 -38 41)" fill="#C6DFB3" stroke="#1F1E1D" stroke-width="1.05"/>
              ${animated ? '<animateTransform attributeName="transform" type="rotate" values="4 0 0; -5 0 0; 4 0 0" dur="5.1s" begin="-1.3s" repeatCount="indefinite"/>' : ""}
            </g>
          </g>
          <!-- 중앙 상단 살랑이는 작은 잎새 -->
          <g transform="translate(${x + 68}, ${y})">
            <g>
              <path d="M0 -2 Q-3 14 2 26" fill="none" stroke="#536B42" stroke-width="1.2" stroke-linecap="round"/>
              <ellipse cx="-7" cy="12" rx="7.2" ry="3.6" transform="rotate(-20 -7 12)" fill="#D6E9C5" stroke="#1F1E1D" stroke-width="1"/>
              <ellipse cx="7" cy="18" rx="7" ry="3.5" transform="rotate(22 7 18)" fill="#C6DFB3" stroke="#1F1E1D" stroke-width="1"/>
              ${animated ? '<animateTransform attributeName="transform" type="rotate" values="-6 0 0; 6 0 0; -6 0 0" dur="3.9s" begin="-0.8s" repeatCount="indefinite"/>' : ""}
            </g>
          </g>
        `;

      case "view_after_rain_rainbow":
        return `
          <defs>
            <linearGradient id="${prefix}wvRainbowSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#EAF3FA"/>
              <stop offset="68%" stop-color="#F6F9FB"/>
              <stop offset="100%" stop-color="#FDFBF6"/>
            </linearGradient>
          </defs>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${prefix}wvRainbowSky)" />
          <!-- 은은한 파스텔 톤 무지개 -->
          <g opacity="0.72">
            <path d="M130 ${y + 114} A60 60 0 0 1 250 ${y + 114}" stroke="#F0B8B8" stroke-width="4.6" fill="none"/>
            <path d="M134.5 ${y + 114} A55.5 55.5 0 0 1 245.5 ${y + 114}" stroke="#F6D5A6" stroke-width="4.6" fill="none"/>
            <path d="M139 ${y + 114} A51 51 0 0 1 241 ${y + 114}" stroke="#F7E8A8" stroke-width="4.6" fill="none"/>
            <path d="M143.5 ${y + 114} A46.5 46.5 0 0 1 236.5 ${y + 114}" stroke="#CBE0BC" stroke-width="4.6" fill="none"/>
            <path d="M148 ${y + 114} A42 42 0 0 1 232 ${y + 114}" stroke="#B8D6E8" stroke-width="4.6" fill="none"/>
            ${animated ? '<animate attributeName="opacity" values="0.58;0.82;0.58" dur="6s" repeatCount="indefinite"/>' : ""}
          </g>
          <!-- 무지개 위로 천천히 흐르는 뭉게구름들 -->
          <g transform="translate(${x}, ${y + 30})">
            <path d="M0 4 C0 0, 7 -2, 11 2 C15 -4, 26 -3, 28 4 C33 4, 34 8, 28 9 L2 9 C-2 9, -2 4, 0 4 Z" fill="#FFFFFF" stroke="#BDBAB2" stroke-width="1" stroke-linejoin="round">
              ${animated ? '<animateTransform attributeName="transform" type="translate" from="-42 0" to="152 0" dur="22s" begin="-7s" repeatCount="indefinite"/>' : 'transform="translate(22, 0)"'}
            </path>
          </g>
          <g transform="translate(${x}, ${y + 100})">
            <path d="M0 5 C0 0, 8 -2, 12 2 C17 -4, 29 -3, 31 4 C36 4, 37 9, 31 10 L2 10 C-3 10, -3 5, 0 5 Z" fill="#FFFFFF" stroke="#B8B4AC" stroke-width="1.05" stroke-linejoin="round">
              ${animated ? '<animateTransform attributeName="transform" type="translate" from="-46 0" to="154 0" dur="18s" begin="-3s" repeatCount="indefinite"/>' : 'transform="translate(14, 0)"'}
            </path>
          </g>
          <g transform="translate(${x}, ${y + 84})">
            <path d="M0 4 C0 0, 6 -1, 10 2 C14 -3, 23 -2, 25 3 C29 3, 30 7, 25 8 L2 8 C-2 8, -2 4, 0 4 Z" fill="#FFFFFF" stroke="#C2BEB6" stroke-width="0.95" stroke-linejoin="round" opacity="0.9">
              ${animated ? '<animateTransform attributeName="transform" type="translate" from="-38 0" to="150 0" dur="25s" begin="-16s" repeatCount="indefinite"/>' : 'transform="translate(88, 0)"'}
            </path>
          </g>
        `;

      case "view_firefly_night": {
        const fireflies = [
          { cx: 146, cy: y + 40, dx: 12, dy: -10, dur: 5.2, blink: 2.6, begin: -0.4 },
          { cx: 212, cy: y + 34, dx: -14, dy: 12, dur: 6.1, blink: 3.2, begin: -1.8 },
          { cx: 172, cy: y + 74, dx: 15, dy: -12, dur: 5.8, blink: 2.9, begin: -2.9 },
          { cx: 234, cy: y + 82, dx: -12, dy: -14, dur: 6.5, blink: 3.5, begin: -0.9 },
          { cx: 144, cy: y + 106, dx: 14, dy: -9, dur: 5.4, blink: 2.4, begin: -2.1 },
          { cx: 198, cy: y + 110, dx: -11, dy: -13, dur: 6.3, blink: 3.1, begin: -3.4 },
          { cx: 242, cy: y + 54, dx: -10, dy: 10, dur: 5.7, blink: 2.8, begin: -1.3 }
        ];
        const fireflyMarkup = fireflies
          .map((f) => `
            <g transform="translate(${f.cx}, ${f.cy})">
              <g>
                <circle cx="0" cy="0" r="6.5" fill="#FDE68A" opacity="0.28">
                  ${animated ? `<animate attributeName="opacity" values="0.06;0.42;0.06" dur="${f.blink}s" begin="${f.begin}s" repeatCount="indefinite"/>` : ""}
                </circle>
                <circle cx="0" cy="0" r="2.1" fill="#FEF08A">
                  ${animated ? `<animate attributeName="opacity" values="0.18;1;0.18" dur="${f.blink}s" begin="${f.begin}s" repeatCount="indefinite"/>` : ""}
                </circle>
                ${animated ? `<animateTransform attributeName="transform" type="translate" values="0 0; ${f.dx} ${f.dy}; ${-f.dx * 0.6} ${f.dy * 0.5}; 0 0" dur="${f.dur}s" begin="${f.begin}s" repeatCount="indefinite"/>` : ""}
              </g>
            </g>
          `)
          .join("");
        return `
          <defs>
            <linearGradient id="${prefix}wvFireflySky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#1E2927"/>
              <stop offset="60%" stop-color="#2B3B37"/>
              <stop offset="100%" stop-color="#394B43"/>
            </linearGradient>
          </defs>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${prefix}wvFireflySky)" />
          <!-- 깊은 숲 실루엣 -->
          <path d="M122 ${y + 116} Q144 ${y + 102} 168 ${y + 114} Q194 ${y + 98} 222 ${y + 112} Q242 ${y + 104} 258 ${y + 114} L258 ${y + 136} L122 ${y + 136} Z" fill="#1C2724" opacity="0.72" />
          ${fireflyMarkup}
        `;
      }

      case "view_sunny_clouds":
        // 1번 '뭉게구름 맑은 날': 따뜻한 연오렌지빛 하늘 + 우측 상단 반짝이는 해와 뻗어 나오는 햇살 선 + 햇살 사이로 흐르는 연필 뭉게구름
        return `
          <defs>
            <linearGradient id="${prefix}wvSunnyGrad" x1="0.8" y1="0" x2="0.2" y2="1">
              <stop offset="0%" stop-color="#F9DFC0"/>
              <stop offset="56%" stop-color="#FDEFD8"/>
              <stop offset="100%" stop-color="#FEF8EC"/>
            </linearGradient>
            <radialGradient id="${prefix}wvSunHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#FFD885" stop-opacity="0.75"/>
              <stop offset="55%" stop-color="#FFE4A8" stop-opacity="0.28"/>
              <stop offset="100%" stop-color="#FDEFD8" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${prefix}wvSunnyGrad)" />
          <!-- 해에서 창문 안쪽으로 뻗어 나오는 부드러운 햇살 선 -->
          <g opacity="0.45">
            <polygon points="236,${y + 24} 122,${y + 96} 122,${y + 128} 236,${y + 34}" fill="#FFF0C4"/>
            <polygon points="236,${y + 28} 142,${y + 136} 180,${y + 136} 244,${y + 36}" fill="#FFF0C4" opacity="0.78"/>
            <polygon points="242,${y + 32} 204,${y + 136} 234,${y + 136} 252,${y + 36}" fill="#FFF0C4" opacity="0.6"/>
            ${animated ? '<animate attributeName="opacity" values="0.34;0.58;0.34" dur="5.2s" repeatCount="indefinite"/>' : ""}
          </g>
          <!-- 우측 상단 따사롭게 반짝이는 해 -->
          <g transform="translate(236, ${y + 24})">
            <circle cx="0" cy="0" r="24" fill="url(#${prefix}wvSunHalo)">
              ${animated ? '<animate attributeName="opacity" values="0.72;1;0.72" dur="4.2s" repeatCount="indefinite"/>' : ""}
            </circle>
            <g stroke="#E3974A" stroke-width="1.25" stroke-linecap="round" opacity="0.82">
              <line x1="0" y1="-16" x2="0" y2="-13"/>
              <line x1="0" y1="13" x2="0" y2="16"/>
              <line x1="-16" y1="0" x2="-13" y2="0"/>
              <line x1="13" y1="0" x2="16" y2="0"/>
              <line x1="-11.3" y1="-11.3" x2="-9.2" y2="-9.2"/>
              <line x1="9.2" y1="9.2" x2="11.3" y2="11.3"/>
              <line x1="-11.3" y1="11.3" x2="-9.2" y2="9.2"/>
              <line x1="9.2" y1="-9.2" x2="11.3" y2="-11.3"/>
              ${animated ? '<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="36s" repeatCount="indefinite"/>' : ""}
            </g>
            <circle cx="0" cy="0" r="9.5" fill="#F8CA78" stroke="#D97736" stroke-width="1.15"/>
          </g>
          <!-- 햇살 사이로 천천히 흐르는 연필 스케치 뭉게구름 3개 -->
          <g transform="translate(${x}, ${y + 34})">
            <path d="M0 5 C0 0, 8 -2, 12 2 C16 -4, 28 -3, 30 4 C35 4, 36 9, 30 10 L2 10 C-3 10, -3 5, 0 5 Z" fill="#FFFFFF" stroke="#B8A99A" stroke-width="1.05" stroke-linejoin="round">
              ${animated ? '<animateTransform attributeName="transform" type="translate" from="-44 0" to="152 0" dur="20s" begin="-5s" repeatCount="indefinite"/>' : 'transform="translate(18, 0)"'}
            </path>
          </g>
          <g transform="translate(${x}, ${y + 74})">
            <path d="M0 4 C0 0, 6 -1, 10 2 C13 -3, 22 -2, 24 3 C28 3, 29 7, 24 8 L2 8 C-2 8, -2 4, 0 4 Z" fill="#FFFFFF" stroke="#C2B4A5" stroke-width="1" stroke-linejoin="round" opacity="0.92">
              ${animated ? '<animateTransform attributeName="transform" type="translate" from="-38 0" to="150 0" dur="25s" begin="-14s" repeatCount="indefinite"/>' : 'transform="translate(86, 0)"'}
            </path>
          </g>
          <g transform="translate(${x}, ${y + 106})">
            <path d="M0 4 C0 0, 7 -1, 11 2 C15 -3, 25 -2, 27 4 C31 4, 32 8, 27 9 L2 9 C-2 9, -2 4, 0 4 Z" fill="#FFFFFF" stroke="#BDB0A1" stroke-width="1" stroke-linejoin="round" opacity="0.88">
              ${animated ? '<animateTransform attributeName="transform" type="translate" from="-40 0" to="150 0" dur="17s" begin="-10s" repeatCount="indefinite"/>' : 'transform="translate(44, 0)"'}
            </path>
          </g>
        `;

      default:
        // 미착용 상태: 깨끗한 기본 빈 창문 (거실 벽면과 동일)
        return "";
    }
  }

  function getSharedLightingDefs(prefix = "") {
    return `
      <radialGradient id="${prefix}lampNaturalGlowGrad" cx="50%" cy="46%" r="50%">
        <stop offset="0%" stop-color="#FFD460" stop-opacity="0.86"/>
        <stop offset="35%" stop-color="#FFC254" stop-opacity="0.54"/>
        <stop offset="68%" stop-color="#FFD480" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#FEF9F1" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="${prefix}lampCoreGlowGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFF09E" stop-opacity="0.95"/>
        <stop offset="55%" stop-color="#FFCA5C" stop-opacity="0.52"/>
        <stop offset="100%" stop-color="#FEF9F1" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="${prefix}sunbeamGrad" cx="50%" cy="30%" r="60%">
        <stop offset="0%" stop-color="#FFFDF8" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="#FEF9F1" stop-opacity="0"/>
      </radialGradient>
    `;
  }

  /**
   * 각 아이템(18종 + 강아지)의 로컬 (0,0) 중심 SVG 마크업 생성기
   * 동물 캐릭터는 내부 비주얼 래퍼(#<id>-visual)를 통해 좌우 방향 반전(Flip) 및
   * 걷기/숨쉬기/장난(play)/휴식(rest) 애니메이션을 수행합니다.
   */
  function getItemLocalSVGMarkup(itemId, isInteractiveMain = false, isLampLit = true) {
    switch (itemId) {
      case "monstera_pot":
        return `
          <path d="M-11 -23 L11 -23 L7.5 0 L-7.5 0 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.6" stroke-linejoin="round" />
          <rect x="-13" y="-27" width="26" height="4.2" rx="1.2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.6" />
          <path d="M0 -27 C-1 -39, -6 -48, -12 -55" fill="none" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round" />
          <path d="M0 -27 C0 -41, 1 -51, 0 -62" fill="none" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round" />
          <path d="M0 -27 C2 -38, 7 -47, 13 -54" fill="none" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round" />
          <path d="M-12 -55 C-18 -58, -19 -50, -13 -48 C-8 -46, -7 -52, -12 -55 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.45" />
          <path d="M-7 -42 C-13 -44, -14 -37, -8 -36 C-4 -35, -3 -40, -7 -42 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.4" />
          <path d="M0 -62 C-4 -68, 4 -68, 3 -61 C2 -56, -2 -57, 0 -62 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.45" />
          <path d="M13 -54 C19 -57, 19 -49, 13 -47 C8 -46, 8 -52, 13 -54 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.45" />
          <path d="M7 -40 C13 -42, 13 -35, 8 -34 C4 -33, 3 -38, 7 -40 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.4" />
        `;

      case "window_cat":
        // 기존 고양이: 사뿐사뿐 걷기 다리 + 앞발 세수(그루밍) + 기지개 + 낮잠 호흡
        return `
          <g data-part="wcat-visual">
            <!-- 걷기 상태일 때만 나타나는 사뿐사뿐 네 다리 -->
            <g data-part="wcat-walk-legs" style="display:none;">
              <line data-part="wcat-leg-fl" x1="-14" y1="-2" x2="-15" y2="4" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round" />
              <line data-part="wcat-leg-fr" x1="-8" y1="-2" x2="-7" y2="4" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round" />
              <line data-part="wcat-leg-bl" x1="10" y1="-2" x2="9" y2="4" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round" />
              <line data-part="wcat-leg-br" x1="16" y1="-2" x2="17" y2="4" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round" />
            </g>
            <path d="M-24 0 C-27 -16, -15 -26, 2 -25 C17 -24, 26 -14, 23 0 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.6" stroke-linejoin="round" />
            <g data-part="wcat-head">
              <path d="M-21 -8 C-24 -16, -19 -24, -11 -23 C-4 -23, -1 -16, -3 -8" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.6" stroke-linecap="round" />
              <path d="M-20 -20 L-23 -29 L-15 -23" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.55" stroke-linejoin="round" />
              <path d="M-10 -23 L-5 -30 L-3 -21" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.55" stroke-linejoin="round" />
              <path d="M-18 -15 Q-15.5 -12.5 -13 -15" fill="none" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round" />
              <path d="M-11 -15 Q-8.5 -12.5 -6 -15" fill="none" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round" />
              <line x1="-28" y1="-13" x2="-23" y2="-13" stroke="#1F1E1D" stroke-width="1.2" stroke-linecap="round" />
              <line x1="-27" y1="-10" x2="-23" y2="-10.5" stroke="#1F1E1D" stroke-width="1.2" stroke-linecap="round" />
            </g>
            <!-- 그루밍(세수)할 때 볼 옆으로 올라오는 앞발 -->
            <ellipse data-part="wcat-groom-paw" cx="-19" cy="-12" rx="3.5" ry="2.3" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.45" style="display:none;" />
            <path data-part="cat-tail-path" d="M21 -3 C29 1, 32 11, 26 15 C21 18, 18 12, 20 7" fill="none" stroke="#1F1E1D" stroke-width="1.6" stroke-linecap="round" />
          </g>
          <g data-part="cat-zzz" opacity="0.85">
            <text x="8" y="-33" fill="#1F1E1D" font-size="9" font-family="sans-serif" font-weight="600">z</text>
            <text x="15" y="-41" fill="#D97736" font-size="11" font-family="sans-serif" font-weight="700">Z</text>
          </g>
        `;

      case "hamster_friend":
        // 햄스터: 쪼르르 달리는 발 + 해바라기씨 오물오물 먹기 + 볼 닦기 + 웅크려 졸기
        return `
          <g data-part="ham-visual">
            <path d="M-11 0 C-13 -13, -8 -23, 0 -23 C8 -23, 13 -13, 11 0 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.55" stroke-linejoin="round" />
            <circle cx="-7" cy="-21" r="3.2" fill="#F3E5D0" stroke="#1F1E1D" stroke-width="1.45" />
            <circle cx="7" cy="-21" r="3.2" fill="#F3E5D0" stroke="#1F1E1D" stroke-width="1.45" />
            <g data-part="ham-eyes-open">
              <circle cx="-4" cy="-14" r="1.3" fill="#1F1E1D" />
              <circle cx="4" cy="-14" r="1.3" fill="#1F1E1D" />
            </g>
            <g data-part="ham-eyes-closed" style="display:none;">
              <path d="M-5.8 -14 Q-4 -12.5 -2.2 -14" fill="none" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round" />
              <path d="M2.2 -14 Q4 -12.5 5.8 -14" fill="none" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round" />
            </g>
            <ellipse cx="-6.5" cy="-11.5" rx="2.1" ry="1.25" fill="#F2B8A2" opacity="0.85" />
            <ellipse cx="6.5" cy="-11.5" rx="2.1" ry="1.25" fill="#F2B8A2" opacity="0.85" />
            <g data-part="ham-hands-seed">
              <path data-part="ham-seed" d="M-2.2 -7.8 L0 -11.6 L2.2 -7.8 Z" fill="#1F1E1D" />
              <circle cx="-2.8" cy="-8.5" r="1.7" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.2" />
              <circle cx="2.8" cy="-8.5" r="1.7" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.2" />
            </g>
            <ellipse data-part="ham-foot-l" cx="-4.5" cy="0" rx="2.4" ry="1.4" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.2" />
            <ellipse data-part="ham-foot-r" cx="4.5" cy="0" rx="2.4" ry="1.4" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.2" />
          </g>
          <g data-part="ham-zzz" style="display:none;">
            <text x="9" y="-24" fill="#D97736" font-size="9.5" font-family="sans-serif" font-weight="700">z</text>
          </g>
        `;

      case "cockatiel_bird":
        // 왕관앵무: 비행 날갯짓 + 창틀/버튼 위 종종걸음 + 깃털 다듬기 + 고개 갸웃
        return `
          <g data-part="cockatiel-visual">
            <path d="M2 -6 L7 5 L2 4 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.55" stroke-linejoin="round" />
            <path d="M-8.5 0 C-11.5 -10, -8.5 -21, 0 -21 C7.5 -21, 10.5 -10, 6.8 0 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
            <path data-part="cockatiel-wing" d="M-2 -15 C4 -14, 7 -7, 3 -2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round" />
            <g data-part="cockatiel-head" transform="translate(-2, -25)">
              <circle cx="0" cy="0" r="8" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.65" />
              <path data-part="cockatiel-crest" d="M-1 -8 C-3 -16, 1 -19, 5 -17 M1 -8 C2 -14, 6 -16, 8.5 -14" fill="none" stroke="#1F1E1D" stroke-width="1.55" stroke-linecap="round" />
              <circle data-part="cockatiel-eye" cx="-3" cy="-1.2" r="1.4" fill="#1F1E1D" />
              <circle cx="0.2" cy="1.5" r="2.4" fill="#E8845B" opacity="0.88" />
              <path d="M-7.8 -1.5 L-12.5 0.5 L-7.8 2 Z" fill="#F4C065" stroke="#1F1E1D" stroke-width="1.45" stroke-linejoin="round" />
            </g>
            <line data-part="cockatiel-foot-l" x1="-3" y1="0" x2="-3.5" y2="1.5" stroke="#1F1E1D" stroke-width="1.6" stroke-linecap="round" />
            <line data-part="cockatiel-foot-r" x1="2.5" y1="0" x2="3" y2="1.5" stroke="#1F1E1D" stroke-width="1.6" stroke-linecap="round" />
          </g>
          <g data-part="cockatiel-zzz" style="display:none;">
            <text x="8" y="-32" fill="#D97736" font-size="9.5" font-family="sans-serif" font-weight="700">z</text>
          </g>
        `;

      case "tuxedo_cat":
        // 말랑 치즈 고양이 (기존 id tuxedo_cat 유지): 하얀 바탕 + 따뜻한 살구/치즈빛 줄무늬 + 분홍 코
        // 사뿐사뿐 걷기 다리 + 앞발 세수(그루밍) + 등 말아 기지개 + 식빵 휴식 모션 모두 유지
        return `
          <g data-part="tuxedo-visual">
            <g data-part="tuxedo-body-wrap">
              <!-- 걷기 상태일 때만 나오는 다리 -->
              <g data-part="tuxedo-walk-legs" style="display:none;">
                <line data-part="tux-leg-fl" x1="-12" y1="-2" x2="-13" y2="4" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
                <line data-part="tux-leg-fr" x1="-5" y1="-2" x2="-4" y2="4" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
                <line data-part="tux-leg-bl" x1="7" y1="-2" x2="6" y2="4" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
                <line data-part="tux-leg-br" x1="13" y1="-2" x2="14" y2="4" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
              </g>
              <path data-part="tuxedo-tail" d="M18 -4 C27 -4, 30 -13, 25 -17" fill="none" stroke="#1F1E1D" stroke-width="2.1" stroke-linecap="round" />
              <rect x="-20" y="-19" width="38" height="19" rx="9" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.7" />
              <!-- 치즈빛 등 줄무늬 포인트 -->
              <path d="M-2 -18.5 C-1 -12, 2 -12, 3 -18.5 Z" fill="#F4C392" />
              <path d="M6 -18.5 C7 -11, 10 -11, 11 -18.5 Z" fill="#F4C392" />
              <path d="M13 -17 C15 -12, 17 -13, 17 -16 Z" fill="#F4C392" />
              <path d="M-12 0 C-12 -8.5, -3 -10, 2 0 Z" fill="#FFFDF9" />
              <ellipse cx="-10" cy="-1" rx="4.2" ry="2.2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.45" />
              <ellipse data-part="tuxedo-groom-paw" cx="-1" cy="-1" rx="4.2" ry="2.2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.45" />
              <g data-part="tuxedo-head" transform="translate(-8, -21)">
                <circle cx="0" cy="0" r="10.2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.65" />
                <path d="M-8.5 -5.5 L-10.5 -14.5 L-2.8 -8.5 Z" fill="#F6CCA2" stroke="#1F1E1D" stroke-width="1.55" stroke-linejoin="round" />
                <path d="M8.5 -5.5 L10.5 -14.5 L2.8 -8.5 Z" fill="#F6CCA2" stroke="#1F1E1D" stroke-width="1.55" stroke-linejoin="round" />
                <!-- 치즈냥 이마 줄무늬 -->
                <path d="M-5 -8.5 Q0 -3.5 5 -8.5" fill="#F4C392" />
                <line x1="0" y1="-9.3" x2="0" y2="-5.4" stroke="#D97736" stroke-width="1.35" stroke-linecap="round" />
                <line x1="-2.5" y1="-8.8" x2="-1.5" y2="-5.8" stroke="#D97736" stroke-width="1.25" stroke-linecap="round" />
                <line x1="2.5" y1="-8.8" x2="1.5" y2="-5.8" stroke="#D97736" stroke-width="1.25" stroke-linecap="round" />
                <g data-part="tuxedo-eyes-open">
                  <circle cx="-3.6" cy="-1.6" r="1.35" fill="#1F1E1D" />
                  <circle cx="3.6" cy="-1.6" r="1.35" fill="#1F1E1D" />
                </g>
                <g data-part="tuxedo-eyes-closed" style="display:none;">
                  <line x1="-5.2" y1="-1.6" x2="-2" y2="-1.6" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round" />
                  <line x1="2" y1="-1.6" x2="5.2" y2="-1.6" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round" />
                </g>
                <ellipse cx="-5.6" cy="1.2" rx="1.9" ry="1.05" fill="#F2B8A2" opacity="0.85" />
                <ellipse cx="5.6" cy="1.2" rx="1.9" ry="1.05" fill="#F2B8A2" opacity="0.85" />
                <polygon points="-1.4,0.5 1.4,0.5 0,2.1" fill="#E8845B" />
                <path d="M-2 2.6 Q0 4.2 2 2.6" fill="none" stroke="#1F1E1D" stroke-width="1.25" stroke-linecap="round" />
              </g>
            </g>
          </g>
          <g data-part="tuxedo-zzz" style="display:none;">
            <text x="10" y="-30" fill="#D97736" font-size="9.5" font-family="sans-serif" font-weight="700">z</text>
          </g>
        `;

      case "welsh_corgi":
        // 웰시코기: 짧은 다리 총총 달리기 + 배 보이고 뒤집어져 데굴데굴 장난(play) + 식빵 자세 휴식(rest)
        return `
          <g data-part="corgi-visual">
            <!-- [1] 기본 서기 / 달리기 / 식빵 휴식 포즈 -->
            <g data-part="corgi-pose-normal">
              <g data-part="corgi-legs-group">
                <line data-part="corgi-leg-bl" x1="-15" y1="-6" x2="-16" y2="0" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round" />
                <line data-part="corgi-leg-br" x1="-9" y1="-6" x2="-9" y2="0" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round" />
                <line data-part="corgi-leg-fl" x1="9" y1="-6" x2="9" y2="0" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round" />
                <line data-part="corgi-leg-fr" x1="15" y1="-6" x2="16" y2="0" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round" />
              </g>
              <rect x="-22" y="-19" width="40" height="14" rx="7" fill="#F6E6CE" stroke="#1F1E1D" stroke-width="1.7" />
              <g data-part="corgi-rump">
                <path d="M-22 -12 C-25 -15, -25 -9, -21 -8" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.55" stroke-linecap="round" />
                <path d="M-17 -10 C-17 -15, -10 -15, -9 -6 L-20 -6 C-22 -7, -20 -10, -17 -10 Z" fill="#FEF9F1" />
              </g>
              <g data-part="corgi-head" transform="translate(17, -21)">
                <path d="M-7 -6 L-10 -17 L-1 -10 Z" fill="#F6E6CE" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
                <path d="M5 -7 L10 -17 L1 -10 Z" fill="#F6E6CE" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
                <circle cx="0" cy="-2" r="10.2" fill="#F6E6CE" stroke="#1F1E1D" stroke-width="1.7" />
                <path d="M-2 -8 C3 -8, 8 -3, 8 2 C8 6, -1 7, -3 3 Z" fill="#FEF9F1" />
                <circle data-part="corgi-eye-open" cx="3.5" cy="-3.5" r="1.45" fill="#1F1E1D" />
                <path data-part="corgi-eye-closed" d="M1.8 -3.5 Q3.5 -2 5.2 -3.5" fill="none" stroke="#1F1E1D" stroke-width="1.35" stroke-linecap="round" style="display:none;" />
                <ellipse cx="10.2" cy="-1.5" rx="2" ry="1.4" fill="#1F1E1D" />
                <ellipse cx="2" cy="1" rx="2.2" ry="1.2" fill="#F2B8A2" opacity="0.8" />
              </g>
            </g>

            <!-- [2] 배를 보이고 발라당 뒤집어져 데굴데굴 장난치는 포즈 (play) -->
            <g data-part="corgi-pose-belly" style="display:none;">
              <rect x="-21" y="-15" width="38" height="14" rx="7" fill="#F6E6CE" stroke="#1F1E1D" stroke-width="1.7" />
              <path d="M-15 -14 C-6 -16, 6 -16, 12 -14 C12 -9, -15 -9, -15 -14 Z" fill="#FEF9F1" />
              <line data-part="corgi-paw-up-1" x1="-13" y1="-14" x2="-15" y2="-21" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round" />
              <line data-part="corgi-paw-up-2" x1="-7" y1="-14" x2="-6" y2="-21" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round" />
              <line data-part="corgi-paw-up-3" x1="6" y1="-14" x2="5" y2="-21" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round" />
              <line data-part="corgi-paw-up-4" x1="12" y1="-14" x2="14" y2="-21" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round" />
              <g transform="translate(17, -10)">
                <circle cx="0" cy="0" r="9.5" fill="#F6E6CE" stroke="#1F1E1D" stroke-width="1.7" />
                <path d="M-4 6 L-8 13 L0 8 Z" fill="#F6E6CE" stroke="#1F1E1D" stroke-width="1.6" stroke-linejoin="round" />
                <path d="M4 6 L9 13 L2 8 Z" fill="#F6E6CE" stroke="#1F1E1D" stroke-width="1.6" stroke-linejoin="round" />
                <path d="M2 -2 Q3.8 -4 5.5 -2" fill="none" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round" />
                <ellipse cx="9.5" cy="-1" rx="1.9" ry="1.3" fill="#1F1E1D" />
                <ellipse cx="2" cy="2" rx="2" ry="1.1" fill="#F2B8A2" opacity="0.8" />
              </g>
            </g>
          </g>
          <g data-part="corgi-zzz" style="display:none;">
            <text x="20" y="-33" fill="#D97736" font-size="9.5" font-family="sans-serif" font-weight="700">z</text>
          </g>
        `;

      case "little_turtle":
        // 꼬마 거북이: 네 발 번갈아 기어가기 + 목 쭉 빼고 두리번거리기(play) + 등껍질 속 휴식(rest)
        return `
          <g data-part="turtle-visual">
            <g data-part="turtle-body-wrap">
              <g data-part="turtle-limbs">
                <ellipse data-part="turtle-leg-bl" cx="-11.5" cy="-1.8" rx="3.8" ry="2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.6" />
                <ellipse data-part="turtle-leg-fl" cx="9.5" cy="-1.8" rx="3.8" ry="2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.6" />
                <path d="M-17.5 -4 L-22.5 -3 L-17.5 -6 Z" fill="#1F1E1D" />
                <g data-part="turtle-head-group">
                  <path d="M13.5 -9 C20.5 -12, 23.5 -9, 22.5 -5 C21.5 -2, 15.5 -3, 13.5 -5" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.6" stroke-linecap="round" />
                  <circle cx="19.5" cy="-8" r="1.2" fill="#1F1E1D" />
                </g>
              </g>
              <path d="M-17.5 -4 C-17.5 -17.5, 15.5 -17.5, 15.5 -4 Z" fill="#DFECC6" stroke="#1F1E1D" stroke-width="1.75" stroke-linejoin="round" />
              <path d="M-18.5 -4 L16.5 -4" stroke="#1F1E1D" stroke-width="1.85" stroke-linecap="round" />
              <path d="M-6 -13.5 L4 -13.5 L7.5 -8 L4 -4 L-6 -4 L-9.5 -8 Z" fill="none" stroke="#1F1E1D" stroke-width="1.3" stroke-linejoin="round" />
              <line x1="-6" y1="-13.5" x2="-8.8" y2="-16" stroke="#1F1E1D" stroke-width="1.25" />
              <line x1="4" y1="-13.5" x2="6.8" y2="-16" stroke="#1F1E1D" stroke-width="1.25" />
            </g>
          </g>
          <g data-part="turtle-zzz" style="display:none;">
            <text x="12" y="-20" fill="#D97736" font-size="9.5" font-family="sans-serif" font-weight="700">z</text>
          </g>
        `;

      case "hedgehog_friend":
        // 고슴도치: 아장아장 발걸음 + 코 킁킁 바닥 탐색(play) + 동그랗게 공처럼 말려 쉬기(rest)
        return `
          <g data-part="hedgehog-visual">
            <g data-part="hedgehog-normal">
              <line data-part="hedge-foot-l" x1="-9" y1="-2" x2="-9" y2="0" stroke="#1F1E1D" stroke-width="1.85" stroke-linecap="round" />
              <line data-part="hedge-foot-r" x1="6" y1="-2" x2="6" y2="0" stroke="#1F1E1D" stroke-width="1.85" stroke-linecap="round" />
              <path d="M-17 -2 L-20 -7 L-15 -10 L-17 -15 L-11 -16 L-11 -21 L-5 -19 L-2 -23 L3 -19 L8 -21 L9 -15 L14 -13 L11 -7 L17 -5 L12 -2 Z" fill="#E8DEC9" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
              <g data-part="hedgehog-snout">
                <path d="M5 -13 C12 -13, 18 -8, 20 -4 C16 -1, 7 -2, 4 -2 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
                <circle cx="13" cy="-7" r="1.3" fill="#1F1E1D" />
                <circle cx="20" cy="-4.5" r="1.55" fill="#1F1E1D" />
                <ellipse cx="11" cy="-4.5" rx="1.8" ry="1" fill="#F2B8A2" opacity="0.8" />
              </g>
              <line x1="-8" y1="-12" x2="-5" y2="-14" stroke="#1F1E1D" stroke-width="1.25" stroke-linecap="round" />
              <line x1="-2" y1="-14" x2="1" y2="-16" stroke="#1F1E1D" stroke-width="1.25" stroke-linecap="round" />
              <line x1="-5" y1="-8" x2="-2" y2="-10" stroke="#1F1E1D" stroke-width="1.25" stroke-linecap="round" />
            </g>
            <g data-part="hedgehog-ball" style="display:none;">
              <path d="M0 -25 L4 -22 L9 -24 L10 -19 L15 -18 L13 -13 L16 -9 L12 -5 L13 -1 L7 -2 L3 0 L0 -3 L-4 0 L-8 -2 L-13 -1 L-12 -6 L-16 -10 L-13 -14 L-15 -19 L-10 -19 L-8 -24 L-4 -22 Z" fill="#E8DEC9" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
              <circle cx="0" cy="-12" r="6" fill="none" stroke="#1F1E1D" stroke-width="1.25" stroke-dasharray="3 2" />
            </g>
          </g>
          <g data-part="hedgehog-zzz" style="display:none;">
            <text x="11" y="-24" fill="#D97736" font-size="9.5" font-family="sans-serif" font-weight="700">z</text>
          </g>
        `;

      case "white_rabbit":
        // 하얀 토끼: 깡총깡총 점프 이동 + 뒷발로 서서 귀 쫑긋(play) + 옆으로 길게 누워 쉬기(rest)
        return `
          <g data-part="rabbit-visual">
            <g data-part="rabbit-body-group">
              <circle cx="-15.5" cy="-6" r="4" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.6" />
              <path d="M-13.5 0 C-15.5 -11.5, -7.5 -19.5, 4 -17.5 C12.5 -16.5, 16.5 -8.5, 13.5 0 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.7" stroke-linejoin="round" />
              <circle cx="8.5" cy="-15.5" r="8" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.7" />
              <g data-part="rabbit-ears">
                <path d="M5 -22 C2 -34, 6 -38, 8 -23" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.65" stroke-linecap="round" />
                <path d="M9.8 -22 C11 -35, 15.5 -37, 13.8 -22" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.65" stroke-linecap="round" />
              </g>
              <circle data-part="rabbit-eye-open" cx="12" cy="-16.5" r="1.35" fill="#1F1E1D" />
              <path data-part="rabbit-eye-closed" d="M10.4 -16.5 Q12 -15 13.6 -16.5" fill="none" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round" style="display:none;" />
              <ellipse cx="10.5" cy="-13.8" rx="1.9" ry="1.05" fill="#F2B8A2" opacity="0.85" />
              <circle cx="16.5" cy="-15" r="1.15" fill="#E8845B" />
            </g>
          </g>
          <g data-part="rabbit-zzz" style="display:none;">
            <text x="15" y="-28" fill="#D97736" font-size="9.5" font-family="sans-serif" font-weight="700">z</text>
          </g>
        `;

      case "goldfish_bowl":
        return `
          <g>
            <path d="M-12 0 L12 0 M-14 -27 C-21 -21, -21 -6, -12 0 L12 0 C21 -6, 21 -21, 14 -27 Z" fill="#F3FAFD" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
            <ellipse cx="0" cy="-27" rx="14" ry="3.1" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.6" />
            <path d="M-15.5 -19 Q-8 -21 0 -19 T15.5 -19" fill="none" stroke="#689EB3" stroke-width="1.25" stroke-linecap="round" />
            <g data-part="goldfish-swimmer" transform="translate(1, -11)">
              <path data-part="goldfish-tail" d="M-6.5 0 L-11.5 -3.8 L-10.5 3.8 Z" fill="#D97736" stroke="#1F1E1D" stroke-width="1.25" stroke-linejoin="round" />
              <ellipse cx="0" cy="0" rx="6.5" ry="4" fill="#D97736" stroke="#1F1E1D" stroke-width="1.4" />
              <circle cx="3.3" cy="-0.8" r="0.95" fill="#1F1E1D" />
            </g>
            <g data-part="goldfish-bubbles" opacity="0">
              <circle cx="4" cy="-17" r="1.4" fill="#FEF9F1" stroke="#689EB3" stroke-width="1.15" />
              <circle cx="7" cy="-22" r="1.9" fill="#FEF9F1" stroke="#689EB3" stroke-width="1.15" />
              <circle cx="3" cy="-27" r="2.3" fill="#FEF9F1" stroke="#689EB3" stroke-width="1.15" />
            </g>
          </g>
        `;

      case "wall_clock":
        return `
          <circle cx="0" cy="0" r="18" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.6" />
          <circle cx="0" cy="0" r="14.5" fill="none" stroke="#E6DEC8" stroke-width="1.1" />
          <line x1="0" y1="-14" x2="0" y2="-11.5" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round" />
          <line x1="0" y1="11.5" x2="0" y2="14" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round" />
          <line x1="-14" y1="0" x2="-11.5" y2="0" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round" />
          <line x1="11.5" y1="0" x2="14" y2="0" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round" />
          <polyline points="0,-9 0,0 6,3.5" fill="none" stroke="#1F1E1D" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="0" cy="0" r="1.6" fill="#D97736" />
        `;

      case "mini_bookshelf":
        return `
          <rect x="-22" y="-6" width="44" height="6" rx="1.8" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.55" />
          <line x1="-16" y1="0" x2="-18" y2="7" stroke="#1F1E1D" stroke-width="1.6" stroke-linecap="round" />
          <line x1="16" y1="0" x2="18" y2="7" stroke="#1F1E1D" stroke-width="1.6" stroke-linecap="round" />
          <rect x="-17" y="-26" width="8" height="20" rx="1.2" fill="#DFECC6" stroke="#1F1E1D" stroke-width="1.5" />
          <rect x="-9" y="-30" width="9" height="24" rx="1.2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.5" />
          <rect x="2" y="-27" width="8" height="21" rx="1.2" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.5" transform="rotate(8 2 -27)" />
        `;

      case "stand_lamp": {
        const glowOpacity = isLampLit ? "1" : "0";
        const shadeFill = isLampLit ? "#FFECB8" : "#FEF9F1";
        return `
          <g data-part="lamp-glow-group" class="lamp-light-effect" style="opacity:${glowOpacity}; pointer-events:none;">
            <ellipse cx="0" cy="-26" rx="68" ry="64" fill="url(#lampNaturalGlowGrad)" />
            <ellipse cx="0" cy="-27" rx="30" ry="26" fill="url(#lampCoreGlowGrad)" />
          </g>
          <line x1="0" y1="-24" x2="0" y2="44" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round" />
          <ellipse cx="0" cy="46" rx="16" ry="4.5" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.6" />
          <path data-part="lamp-shade-path" class="lamp-shade-path" d="M-14 -48 L14 -48 L20 -24 L-20 -24 Z" fill="${shadeFill}" stroke="#1F1E1D" stroke-width="1.6" stroke-linejoin="round" />
          <line x1="7" y1="-24" x2="7" y2="-14" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round" />
          <circle cx="7" cy="-12.5" r="1.7" fill="#D97736" />
        `;
      }

      case "wall_wood_branch":
        // 나뭇가지 윗면(y = -4)은 앵무새가 편안하게 올라앉도록 매끈한 수평·완만한 곡선으로 비워두고,
        // 잔가지와 나뭇잎 3개는 나뭇가지 아랫면으로 부드럽게 드리워지도록 구성
        return `
          <ellipse cx="32" cy="1" rx="3.6" ry="8.2" fill="#D8C3A5" stroke="#1F1E1D" stroke-width="1.65" />
          <path d="M32 -4 C14 -4.4, -10 -4.2, -29 -3.6 C-33.5 -3.4, -33.5 1.8, -29 2.2 C-10 2.6, 14 3.4, 32 5.8 Z" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.7" stroke-linejoin="round" />
          <line x1="-18" y1="-0.8" x2="12" y2="-0.2" stroke="#1F1E1D" stroke-width="1.15" stroke-linecap="round" opacity="0.55" />
          <path d="M-9 2.3 C-14 8.5, -21 11.8, -27 12.6" fill="none" stroke="#1F1E1D" stroke-width="1.6" stroke-linecap="round" />
          <path d="M9 2.8 C5 8.5, 0 12.2, -5 13.8" fill="none" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round" />
          <path d="M-27 12.6 C-34 14.5, -34 7.5, -27.5 6.8 C-22.5 6.2, -21.8 11.2, -27 12.6 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.45" />
          <path d="M-16 9.8 C-20.5 15.2, -14.2 19.2, -11.5 13.4 C-9.8 9.6, -13 7.8, -16 9.8 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.4" />
          <path d="M-5 13.8 C-9.2 19.5, -1.2 21.5, 1.2 15.2 C2.4 11.5, -2.5 10.2, -5 13.8 Z" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.45" />
        `;

      case "beige_cushion":
        // 강아지·고양이·토끼가 넉넉히 올라갈 수 있는 큼직한 코튼 방석
        return `
          <ellipse cx="0" cy="0" rx="48" ry="17.5" fill="#F5EBDC" stroke="#1F1E1D" stroke-width="1.7" />
          <ellipse cx="0" cy="-2" rx="38" ry="12" fill="#FAF2E4" stroke="#1F1E1D" stroke-width="1.2" stroke-dasharray="3.5 2.5" />
          <path d="M-38 -3 C-22 6, 22 6, 38 -3" fill="none" stroke="#1F1E1D" stroke-width="1.35" stroke-linecap="round" />
          <path d="M-11 -6 Q0 -1 11 -6" fill="none" stroke="#1F1E1D" stroke-width="1.35" stroke-linecap="round" />
        `;

      case "ceramic_bowl":
        return `
          <path d="M-16 -8 L16 -8 L12 7 C11 10, -11 10, -12 7 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.55" stroke-linejoin="round" />
          <ellipse cx="0" cy="-8" rx="16" ry="4.8" fill="#E5F1F6" stroke="#1F1E1D" stroke-width="1.55" />
          <path d="M-8 -8 Q-4 -9.5 0 -8 T8 -8" fill="none" stroke="#689EB3" stroke-width="1.2" stroke-linecap="round" />
          <circle cx="0" cy="1" r="1.8" fill="#D97736" />
        `;

      case "tennis_ball":
        return `
          <g data-part="ball-body">
            <circle cx="0" cy="0" r="10.5" fill="#DCE9B8" stroke="#1F1E1D" stroke-width="1.55" />
            <path d="M-7 -6 C-2 -2, -2 2, -7 6" fill="none" stroke="#1F1E1D" stroke-width="1.25" stroke-linecap="round" />
            <path d="M7 -6 C2 -2, 2 2, 7 6" fill="none" stroke="#1F1E1D" stroke-width="1.25" stroke-linecap="round" />
          </g>
        `;

      case "yarn_ball":
        return `
          <circle cx="0" cy="0" r="11" fill="#F5C7B0" stroke="#1F1E1D" stroke-width="1.55" />
          <path d="M-8 -4 C-2 -6, 4 -2, 7 4" fill="none" stroke="#1F1E1D" stroke-width="1.2" stroke-linecap="round" />
          <path d="M-8 3 C-2 0, 4 3, 6 8" fill="none" stroke="#1F1E1D" stroke-width="1.2" stroke-linecap="round" />
          <path d="M8 7 C13 10, 17 7, 21 10" fill="none" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round" />
        `;

      /* ================= [신규 펫 용품 5종 (동물 비율에 맞춰 대형화 & 인터랙션 보정)] ================= */
      case "wooden_bird_perch":
        // 왕관앵무가 넉넉히 앉을 수 있는 원목 새 횃대 (가로 바 상단 y = -52)
        return `
          <ellipse cx="0" cy="-2" rx="20" ry="4.2" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.65" />
          <line x1="0" y1="-4" x2="0" y2="-48" stroke="#1F1E1D" stroke-width="2.1" stroke-linecap="round" />
          <rect x="-24" y="-52" width="48" height="4.8" rx="2.4" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.7" />
          <line x1="-13" y1="-33" x2="0" y2="-26" stroke="#1F1E1D" stroke-width="1.75" stroke-linecap="round" />
          <line x1="15" y1="-47.2" x2="15" y2="-39" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round" />
          <circle cx="15" cy="-37" r="2.4" fill="#F4C065" stroke="#1F1E1D" stroke-width="1.3" />
        `;

      case "mini_cat_tower":
        // 대형 3단 원목 캣타워 (스탠드 조명급 높이 96px, 가로 72px: 1층 숨숨집 + 스크래처 기둥 + 2층 좌/우 발판 + 3층 꼭대기 둥지 + 폼폼 장난감)
        return `
          <!-- 바닥 베이스 보드 -->
          <rect x="-36" y="-6" width="72" height="6" rx="2.5" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.75" />
          <!-- 1층 좌측 원목 숨숨집 -->
          <rect x="-28" y="-34" width="27" height="28" rx="2.5" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.7" />
          <path d="M-20 -6 L-20 -20 A5.5 5.5 0 0 1 -9 -20 L-9 -6 Z" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.55" />
          <circle cx="-14.5" cy="-26.5" r="2.2" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.3" />
          <!-- 우측 메인 스크래처 기둥 (빗금 디테일) -->
          <rect x="11" y="-56" width="7.5" height="50" fill="#F5EBDC" stroke="#1F1E1D" stroke-width="1.65" />
          <line x1="11" y1="-48" x2="18.5" y2="-45" stroke="#1F1E1D" stroke-width="1.2" />
          <line x1="11" y1="-40" x2="18.5" y2="-37" stroke="#1F1E1D" stroke-width="1.2" />
          <line x1="11" y1="-32" x2="18.5" y2="-29" stroke="#1F1E1D" stroke-width="1.2" />
          <line x1="11" y1="-24" x2="18.5" y2="-21" stroke="#1F1E1D" stroke-width="1.2" />
          <line x1="11" y1="-16" x2="18.5" y2="-13" stroke="#1F1E1D" stroke-width="1.2" />
          <!-- 좌측 서브 기둥 -->
          <rect x="-21" y="-53" width="6" height="19" fill="#F5EBDC" stroke="#1F1E1D" stroke-width="1.55" />
          <line x1="-21" y1="-46" x2="-15" y2="-43.5" stroke="#1F1E1D" stroke-width="1.15" />
          <line x1="-21" y1="-39" x2="-15" y2="-36.5" stroke="#1F1E1D" stroke-width="1.15" />
          <!-- 2단 좌측 중간 발판 (상단 y = -58) -->
          <rect x="-33" y="-58" width="32" height="5.5" rx="2.5" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.7" />
          <!-- 2단 우측 메인 발판 (상단 y = -62) -->
          <rect x="-3" y="-62" width="36" height="6" rx="2.5" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.7" />
          <!-- 매달린 폼폼 방울 장난감 -->
          <line x1="26" y1="-56" x2="26" y2="-44" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round" />
          <circle cx="26" cy="-41" r="3.4" fill="#E99A7E" stroke="#1F1E1D" stroke-width="1.4" />
          <!-- 3단 상부 스크래처 기둥 -->
          <rect x="-12" y="-88" width="6.5" height="30" fill="#F5EBDC" stroke="#1F1E1D" stroke-width="1.6" />
          <line x1="-12" y1="-80" x2="-5.5" y2="-77.5" stroke="#1F1E1D" stroke-width="1.15" />
          <line x1="-12" y1="-72" x2="-5.5" y2="-69.5" stroke="#1F1E1D" stroke-width="1.15" />
          <line x1="-12" y1="-64" x2="-5.5" y2="-61.5" stroke="#1F1E1D" stroke-width="1.15" />
          <!-- 3단 꼭대기 둥지 베드 (상단 y = -94) -->
          <path d="M-29 -94 L11 -94 L8 -88 L-26 -88 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.7" stroke-linejoin="round" />
          <rect x="-31" y="-96" width="44" height="4" rx="2" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.65" />
        `;

      case "cozy_tent_house":
        // 동물 크기 대비 넉넉하고 포근한 인디언 텐트 숨숨집
        return `
          <line x1="-30" y1="0" x2="5" y2="-60" stroke="#1F1E1D" stroke-width="1.85" stroke-linecap="round" />
          <line x1="30" y1="0" x2="-5" y2="-60" stroke="#1F1E1D" stroke-width="1.85" stroke-linecap="round" />
          <line x1="0" y1="0" x2="0" y2="-62" stroke="#1F1E1D" stroke-width="1.65" stroke-linecap="round" />
          <polygon points="0,-52 -31,0 31,0" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.75" stroke-linejoin="round" />
          <line x1="-15" y1="-26" x2="15" y2="-26" stroke="#E6DEC8" stroke-width="1.2" stroke-dasharray="3 2" />
          <polygon points="0,-26 -13.5,0 13.5,0" fill="#EAE0D0" stroke="#1F1E1D" stroke-width="1.6" stroke-linejoin="round" />
          <ellipse cx="0" cy="-1.5" rx="12.5" ry="3.2" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.4" />
        `;

      case "yellow_duck_toy":
        return `
          <g data-part="duck-toy-body">
            <path d="M-11 0 C-14 0, -16 -9, -9 -12 C-3 -13, 8 -13, 12 -8 C15 -4, 12 0, 8 0 Z" fill="#F9E07F" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
            <circle cx="5" cy="-15.5" r="7" fill="#F9E07F" stroke="#1F1E1D" stroke-width="1.65" />
            <circle cx="7.2" cy="-17" r="1.3" fill="#1F1E1D" />
            <path d="M11.5 -16 L16.5 -14.5 L11.5 -13 Z" fill="#E8845B" stroke="#1F1E1D" stroke-width="1.45" stroke-linejoin="round" />
            <path d="M-5 -6 C-1 -8, 4 -7, 3 -4" fill="none" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round" />
          </g>
        `;

      case "hamster_wheel":
        // 햄스터가 실제로 안에 쏙 들어가 달릴 수 있는 1.5배 넉넉한 우드 쳇바퀴 (중심 y = -28, 반지름 21)
        return `
          <rect x="-21" y="-4.5" width="42" height="4.5" rx="2" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.65" />
          <path d="M-12 -4.5 L0 -28 L12 -4.5" fill="none" stroke="#1F1E1D" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
          <g transform="translate(0, -28)">
            <g data-part="hamster-wheel-rotor">
              <circle cx="0" cy="0" r="21" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.75" />
              <circle cx="0" cy="0" r="16.5" fill="none" stroke="#E9DAC6" stroke-width="1.5" />
              <line x1="-16.5" y1="0" x2="16.5" y2="0" stroke="#1F1E1D" stroke-width="1.3" />
              <line x1="0" y1="-16.5" x2="0" y2="16.5" stroke="#1F1E1D" stroke-width="1.3" />
              <line x1="-11.6" y1="-11.6" x2="11.6" y2="11.6" stroke="#E6DEC8" stroke-width="1.15" />
              <line x1="-11.6" y1="11.6" x2="11.6" y2="-11.6" stroke="#E6DEC8" stroke-width="1.15" />
            </g>
            <circle cx="0" cy="0" r="3" fill="#D97736" stroke="#1F1E1D" stroke-width="1.4" />
          </g>
        `;

      /* ================= [신규 가구·조명 8종] ================= */
      case "cloud_wall_lamp": {
        const glowOpacity = isLampLit ? "1" : "0";
        const bodyFill = isLampLit ? "#FFF3C8" : "#FEF9F1";
        return `
          <g data-part="light-glow-cloud_wall_lamp" class="lamp-light-effect" style="opacity:${glowOpacity}; pointer-events:none;">
            <ellipse cx="0" cy="-2" rx="46" ry="34" fill="url(#lampNaturalGlowGrad)" />
            <ellipse cx="0" cy="-2" rx="22" ry="16" fill="url(#lampCoreGlowGrad)" />
          </g>
          <path data-part="light-body-cloud_wall_lamp" class="lamp-shade-path" d="M-16 9 L15 9 C21 9, 24 3, 19 -1 C20 -8, 12 -12, 7 -8 C4 -15, -7 -15, -10 -7 C-17 -8, -22 -2, -19 4 C-22 6, -20 9, -16 9 Z" fill="${bodyFill}" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
          <path d="M-6 1 Q-4 3 -2 1" fill="none" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round" />
          <path d="M3 1 Q5 3 7 1" fill="none" stroke="#1F1E1D" stroke-width="1.3" stroke-linecap="round" />
          <ellipse cx="-8" cy="2.5" rx="1.8" ry="1" fill="#F2B8A2" opacity="0.8" />
          <ellipse cx="9" cy="2.5" rx="1.8" ry="1" fill="#F2B8A2" opacity="0.8" />
        `;
      }

      case "crescent_mood_lamp": {
        const glowOpacity = isLampLit ? "1" : "0";
        const bodyFill = isLampLit ? "#FFE79B" : "#FEF9F1";
        return `
          <g data-part="light-glow-crescent_mood_lamp" class="lamp-light-effect" style="opacity:${glowOpacity}; pointer-events:none;">
            <circle cx="0" cy="-17" r="38" fill="url(#lampNaturalGlowGrad)" />
            <circle cx="0" cy="-17" r="18" fill="url(#lampCoreGlowGrad)" />
          </g>
          <rect x="-11" y="-4" width="22" height="4" rx="1.8" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.6" />
          <path data-part="light-body-crescent_mood_lamp" class="lamp-shade-path" d="M2 -29 C-11 -29, -15 -11, 2 -5 C-5 -10, -4 -23, 2 -29 Z" fill="${bodyFill}" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
          <circle cx="6" cy="-18" r="1.7" fill="#F4C065" />
        `;
      }

      case "mushroom_stand_lamp": {
        const glowOpacity = isLampLit ? "1" : "0";
        const bodyFill = isLampLit ? "#FFECB8" : "#FEF9F1";
        return `
          <g data-part="light-glow-mushroom_stand_lamp" class="lamp-light-effect" style="opacity:${glowOpacity}; pointer-events:none;">
            <ellipse cx="0" cy="-16" rx="40" ry="34" fill="url(#lampNaturalGlowGrad)" />
            <ellipse cx="0" cy="-16" rx="19" ry="15" fill="url(#lampCoreGlowGrad)" />
          </g>
          <path d="M-7 0 L-5 -14 L5 -14 L7 0 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.6" stroke-linejoin="round" />
          <path data-part="light-body-mushroom_stand_lamp" class="lamp-shade-path" d="M-16 -14 C-16 -27, 16 -27, 16 -14 Z" fill="${bodyFill}" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
          <line x1="6" y1="-14" x2="6" y2="-9" stroke="#1F1E1D" stroke-width="1.25" stroke-linecap="round" />
          <circle cx="6" cy="-8" r="1.4" fill="#D97736" />
        `;
      }

      case "starlight_garland": {
        const glowOpacity = isLampLit ? "1" : "0";
        const bulbFill = isLampLit ? "#FFE688" : "#FEF9F1";
        return `
          <g data-part="light-glow-starlight_garland" class="lamp-light-effect" style="opacity:${glowOpacity}; pointer-events:none;">
            <ellipse cx="0" cy="8" rx="54" ry="26" fill="url(#lampNaturalGlowGrad)" />
          </g>
          <path d="M-36 -6 Q0 10 36 -6" fill="none" stroke="#1F1E1D" stroke-width="1.55" stroke-linecap="round" />
          <circle cx="-36" cy="-6" r="1.8" fill="#1F1E1D" />
          <circle cx="36" cy="-6" r="1.8" fill="#1F1E1D" />
          <line x1="-22" y1="-1" x2="-22" y2="6" stroke="#1F1E1D" stroke-width="1.2" />
          <line x1="-8" y1="2" x2="-8" y2="10" stroke="#1F1E1D" stroke-width="1.2" />
          <line x1="8" y1="2" x2="8" y2="10" stroke="#1F1E1D" stroke-width="1.2" />
          <line x1="22" y1="-1" x2="22" y2="6" stroke="#1F1E1D" stroke-width="1.2" />
          <g data-part="light-bulbs-starlight_garland">
            <circle class="garland-bulb" cx="-22" cy="9" r="3.3" fill="${bulbFill}" stroke="#1F1E1D" stroke-width="1.4" />
            <circle class="garland-bulb" cx="-8" cy="13" r="3.5" fill="${bulbFill}" stroke="#1F1E1D" stroke-width="1.4" />
            <circle class="garland-bulb" cx="8" cy="13" r="3.5" fill="${bulbFill}" stroke="#1F1E1D" stroke-width="1.4" />
            <circle class="garland-bulb" cx="22" cy="9" r="3.3" fill="${bulbFill}" stroke="#1F1E1D" stroke-width="1.4" />
          </g>
        `;
      }

      case "cozy_single_sofa":
        // 동물 크기 대비 넉넉한 비율로 키운 포근 1인용 패브릭 소파
        return `
          <line x1="-23" y1="-7" x2="-26" y2="0" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round" />
          <line x1="23" y1="-7" x2="26" y2="0" stroke="#1F1E1D" stroke-width="2" stroke-linecap="round" />
          <rect x="-26" y="-46" width="52" height="31" rx="11" fill="#F5EBDC" stroke="#1F1E1D" stroke-width="1.75" />
          <rect x="-32" y="-29" width="11" height="22" rx="5.5" fill="#EAE0D0" stroke="#1F1E1D" stroke-width="1.65" />
          <rect x="21" y="-29" width="11" height="22" rx="5.5" fill="#EAE0D0" stroke="#1F1E1D" stroke-width="1.65" />
          <rect x="-21" y="-19" width="42" height="12" rx="5" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.65" />
          <rect x="-12" y="-33" width="14" height="14" rx="3.5" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.5" transform="rotate(-10 -5 -26)" />
        `;

      case "wooden_tea_table":
        return `
          <line x1="-12" y1="-16" x2="-16" y2="0" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
          <line x1="12" y1="-16" x2="16" y2="0" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
          <line x1="0" y1="-15" x2="0" y2="-1" stroke="#1F1E1D" stroke-width="1.65" stroke-linecap="round" />
          <ellipse cx="0" cy="-18" rx="24" ry="7" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.65" />
          <ellipse cx="2" cy="-19.5" rx="6" ry="2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.35" />
          <path d="M-2 -24 L6 -24 L5 -19.5 L-1 -19.5 Z" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.4" stroke-linejoin="round" />
          <path d="M1.5 -27 Q2.8 -29.5 1.5 -32" fill="none" stroke="#1F1E1D" stroke-width="1.2" stroke-linecap="round" />
        `;

      case "vintage_turntable":
        return `
          <rect x="-22" y="-7" width="44" height="7" rx="2" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.65" />
          <polygon points="-22,-7 -16,-19 16,-19 22,-7" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
          <g transform="translate(-2, -13)">
            <ellipse cx="0" cy="0" rx="12" ry="4.6" fill="#2C2A29" stroke="#1F1E1D" stroke-width="1.45" />
            <ellipse data-part="turntable-disc-label" cx="0" cy="0" rx="4.2" ry="1.7" fill="#E8845B" />
          </g>
          <line x1="13" y1="-16" x2="5" y2="-11" stroke="#1F1E1D" stroke-width="1.45" stroke-linecap="round" />
          <g data-part="turntable-notes" opacity="0">
            <text x="-5" y="-23" fill="#D97736" font-size="10" font-weight="800" font-family="sans-serif">♪</text>
            <text x="5" y="-27" fill="#1F1E1D" font-size="9.5" font-weight="800" font-family="sans-serif">♫</text>
          </g>
        `;

      case "rattan_basket":
        return `
          <path d="M-8 -18 C-4 -25, 10 -24, 12 -18 Z" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.5" />
          <path d="M-16 -18 L16 -18 L13 0 L-13 0 Z" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
          <path d="M-14 -18 C-14 -23, -8 -23, -8 -18" fill="none" stroke="#1F1E1D" stroke-width="1.55" stroke-linecap="round" />
          <path d="M8 -18 C8 -23, 14 -23, 14 -18" fill="none" stroke="#1F1E1D" stroke-width="1.55" stroke-linecap="round" />
          <line x1="-14.5" y1="-12" x2="14.5" y2="-12" stroke="#1F1E1D" stroke-width="1.25" />
          <line x1="-13.5" y1="-6" x2="13.5" y2="-6" stroke="#1F1E1D" stroke-width="1.25" />
        `;

      /* ================= [신규 식물·데코 8종] ================= */
      case "mini_cactus_pot":
        return `
          <path d="M-9 -14 L9 -14 L6.5 0 L-6.5 0 Z" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.6" stroke-linejoin="round" />
          <rect x="-10.5" y="-17.5" width="21" height="3.5" rx="1.2" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.6" />
          <ellipse cx="0" cy="-26" rx="7.5" ry="10.5" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.65" />
          <circle cx="6.5" cy="-28.5" r="3.4" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.55" />
          <circle cx="0" cy="-37" r="2.8" fill="#E99A7E" stroke="#1F1E1D" stroke-width="1.45" />
          <line x1="-2.5" y1="-28" x2="-3.5" y2="-29" stroke="#1F1E1D" stroke-width="1.15" stroke-linecap="round" />
          <line x1="2.5" y1="-23" x2="3.5" y2="-24" stroke="#1F1E1D" stroke-width="1.15" stroke-linecap="round" />
        `;

      case "tulip_glass_vase":
        return `
          <path d="M-4 -8 C-4 -19, -7 -26, -8 -31" fill="none" stroke="#4F6F33" stroke-width="1.55" stroke-linecap="round" />
          <path d="M2 -8 C2 -20, 5 -28, 7 -34" fill="none" stroke="#4F6F33" stroke-width="1.55" stroke-linecap="round" />
          <path d="M-7 -20 L7 -20 L10 -4 C10 -1, -10 -1, -10 -4 Z" fill="#F3FAFD" fill-opacity="0.82" stroke="#1F1E1D" stroke-width="1.6" stroke-linejoin="round" />
          <path d="M-8.5 -10 Q0 -11.5 8.5 -10" fill="none" stroke="#689EB3" stroke-width="1.2" stroke-linecap="round" />
          <path d="M-12 -31 C-12 -37, -4 -37, -4 -31 C-4 -27, -12 -27, -12 -31 Z" fill="#E99A7E" stroke="#1F1E1D" stroke-width="1.5" />
          <path d="M3 -34 C3 -40, 11 -40, 11 -34 C11 -30, 3 -30, 3 -34 Z" fill="#F4C065" stroke="#1F1E1D" stroke-width="1.5" />
        `;

      case "hanging_plant":
        return `
          <circle cx="0" cy="-26" r="2.2" fill="none" stroke="#1F1E1D" stroke-width="1.5" />
          <line x1="0" y1="-24" x2="-10" y2="-8" stroke="#1F1E1D" stroke-width="1.3" />
          <line x1="0" y1="-24" x2="10" y2="-8" stroke="#1F1E1D" stroke-width="1.3" />
          <path d="M-11 -8 L11 -8 L8 2 L-8 2 Z" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
          <path d="M-7 0 Q-12 10 -8 20" fill="none" stroke="#1F1E1D" stroke-width="1.45" stroke-linecap="round" />
          <path d="M0 2 Q2 12 -1 22" fill="none" stroke="#1F1E1D" stroke-width="1.45" stroke-linecap="round" />
          <path d="M7 0 Q12 9 9 18" fill="none" stroke="#1F1E1D" stroke-width="1.45" stroke-linecap="round" />
          <circle cx="-9" cy="8" r="2.5" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.3" />
          <circle cx="-8" cy="18" r="2.5" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.3" />
          <circle cx="1" cy="11" r="2.5" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.3" />
          <circle cx="-1" cy="21" r="2.5" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.3" />
          <circle cx="10" cy="8" r="2.5" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.3" />
          <circle cx="9" cy="17" r="2.5" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.3" />
        `;

      case "croquis_frame":
        return `
          <path d="M-7 -15 L0 -21 L7 -15" fill="none" stroke="#1F1E1D" stroke-width="1.3" />
          <circle cx="0" cy="-21" r="1.4" fill="#1F1E1D" />
          <rect x="-18" y="-15" width="36" height="28" rx="2.5" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.65" />
          <rect x="-14" y="-11" width="28" height="20" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.35" />
          <circle cx="6" cy="-4" r="3.4" fill="#F4C065" stroke="#1F1E1D" stroke-width="1.3" />
          <path d="M-14 7 Q-6 -2 2 5 T14 4 L14 9 L-14 9 Z" fill="#DFECC6" stroke="#1F1E1D" stroke-width="1.3" stroke-linejoin="round" />
        `;

      case "aroma_candle": {
        const glowOpacity = isLampLit ? "1" : "0";
        const flameDisplay = isLampLit ? "block" : "none";
        return `
          <g data-part="light-glow-aroma_candle" class="lamp-light-effect" style="opacity:${glowOpacity}; pointer-events:none;">
            <circle cx="0" cy="-23" r="28" fill="url(#lampNaturalGlowGrad)" />
            <circle cx="0" cy="-23" r="13" fill="url(#lampCoreGlowGrad)" />
          </g>
          <rect x="-10" y="-2.5" width="20" height="2.5" rx="1" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.5" />
          <rect x="-8" y="-18" width="16" height="15.5" rx="2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.65" />
          <rect x="-5" y="-12.5" width="10" height="5.5" rx="1" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.2" />
          <line x1="0" y1="-18" x2="0" y2="-20.5" stroke="#1F1E1D" stroke-width="1.35" stroke-linecap="round" />
          <path data-part="candle-flame-aroma_candle" d="M0 -28 C-3.2 -24, -2.5 -20.5, 0 -20.5 C2.5 -20.5, 3.2 -24, 0 -28 Z" fill="#FFB347" stroke="#1F1E1D" stroke-width="1.3" stroke-linejoin="round" style="display:${flameDisplay};" />
        `;
      }

      case "cozy_dreamcatcher":
        return `
          <line x1="0" y1="-22" x2="0" y2="-15" stroke="#1F1E1D" stroke-width="1.45" stroke-linecap="round" />
          <circle cx="0" cy="-4" r="11" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.65" />
          <polygon points="0,-12 7,-4 0,4 -7,-4" fill="none" stroke="#1F1E1D" stroke-width="1.15" />
          <circle cx="0" cy="-4" r="2.1" fill="#D97736" />
          <path d="M-6 6 L-6 13 C-9 17, -9 22, -6 25 C-3 22, -3 17, -6 13 Z" fill="#F6D5C1" stroke="#1F1E1D" stroke-width="1.35" />
          <path d="M0 7 L0 15 C-3.2 20, -3.2 25, 0 28 C3.2 25, 3.2 20, 0 15 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.35" />
          <path d="M6 6 L6 13 C3 17, 3 22, 6 25 C9 22, 9 17, 6 13 Z" fill="#DFECC6" stroke="#1F1E1D" stroke-width="1.35" />
        `;

      case "mini_desk_calendar":
        return `
          <polygon points="-13,0 13,0 16,-4 -10,-4" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.5" stroke-linejoin="round" />
          <rect x="-13" y="-23" width="26" height="23" rx="2" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.65" />
          <path d="M-13 -17 L13 -17" stroke="#1F1E1D" stroke-width="1.45" />
          <line x1="-7" y1="-25.5" x2="-7" y2="-20.5" stroke="#1F1E1D" stroke-width="1.65" stroke-linecap="round" />
          <line x1="0" y1="-25.5" x2="0" y2="-20.5" stroke="#1F1E1D" stroke-width="1.65" stroke-linecap="round" />
          <line x1="7" y1="-25.5" x2="7" y2="-20.5" stroke="#1F1E1D" stroke-width="1.65" stroke-linecap="round" />
          <text x="0" y="-5" text-anchor="middle" fill="#D97736" font-size="10.5" font-weight="800" font-family="sans-serif">24</text>
        `;

      case "sparkle_snow_globe":
        return `
          <g data-part="snow-globe-wrap">
            <path d="M-13 0 L13 0 L10 -6 L-10 -6 Z" fill="#E9DAC6" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
            <circle cx="0" cy="-18" r="14" fill="#F3FAFD" stroke="#1F1E1D" stroke-width="1.65" />
            <polygon points="0,-25 -5,-15 5,-15" fill="#CFE0BC" stroke="#1F1E1D" stroke-width="1.4" stroke-linejoin="round" />
            <line x1="0" y1="-15" x2="0" y2="-11" stroke="#1F1E1D" stroke-width="1.4" />
            <path d="M-11 -11 Q0 -13 11 -11" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.25" />
            <g data-part="snow-globe-flakes">
              <circle cx="-6" cy="-23" r="1.25" fill="#D97736" />
              <circle cx="6" cy="-21" r="1.25" fill="#D97736" />
              <circle cx="-2" cy="-28" r="1.15" fill="#1F1E1D" />
              <circle cx="4" cy="-26" r="1.1" fill="#689EB3" />
            </g>
          </g>
        `;

      default:
        return "";
    }
  }

  class LivingRoomScene {
    constructor(svgElement, speechBubbleEl) {
      this.svg = svgElement;
      this.bubbleEl = speechBubbleEl;

      this.placedItems = new Set([]);
      this.focusMode = "idle"; // 'idle' | 'running' | 'paused'
      this.lampLit = appStorage ? appStorage.getLampLit() : true;

      // 1) 기본 강아지 5단계 상태 머신 (walk, idle, play, rest, react + 베이지 방석 낮잠 연동)
      this.dog = {
        x: 196,
        y: 296,
        baseY: 296,
        targetX: 235,
        targetY: 296,
        moveDir: 1, // +1: 오른쪽, -1: 왼쪽
        state: "idle", // 'walk' | 'idle' | 'play' | 'rest' | 'react'
        nextActionAfterWalk: null, // 'rest_on_cushion'
        playSubMode: "bow", // 'bow' (기지개) | 'patter' (배 깔고 앞발 꼼지락)
        stateTimer: 3.5,
        walkCycle: 0,
        reactTimer: 0,
        userHoldTimer: 0
      };

      // 2) 나머지 동물 9종의 통합 5단계 상태 머신
      this.animals = {
        window_cat: this.createAnimalState(298, WINDOW_SILL_Y, -1, 34),
        tuxedo_cat: this.createAnimalState(224, WINDOW_SILL_Y, -1, 34),
        hamster_friend: this.createAnimalState(105, WINDOW_SILL_Y - 1, 1, 52),
        cockatiel_bird: this.createAnimalState(158, WINDOW_MID_Y - 1.5, -1, 40),
        welsh_corgi: this.createAnimalState(135, 350, 1, 68),
        little_turtle: this.createAnimalState(245, 392, -1, 12),
        hedgehog_friend: this.createAnimalState(86, 365, 1, 30),
        white_rabbit: this.createAnimalState(278, 345, -1, 48),
        goldfish_bowl: {
          x: 312,
          y: WINDOW_SILL_Y,
          state: "walk", // 'walk' (8자 유영) | 'play' (수면 뻐끔 물방울) | 'rest' (바닥 휴식)
          stateTimer: 5.0,
          swimPhase: 0,
          bubbleTimer: 0
        }
      };

      this.dragState = null;
      this.initializedAnimalPositions = new Set();
      this.extraAnimalStates = new Map();
      this.ballBounce = 0;
      this.duckSqueakTimer = 0;
      this.wheelSpinTimer = 0;
      this.wheelSpinAngle = 0;
      this.turntablePlayTimer = 0;
      this.snowGlobeShakeTimer = 0;
      this.bubbleTimeout = null;
      this.lastFrameTime = performance.now();
      this.rafId = null;

      this.buildStaticStructure();
      this.bindDragAndTapEvents();
      this.startLoop();

      requestAnimationFrame(() => {
        this.syncPositionsFromStorage();
      });
    }

    createAnimalState(x, y, initMoveDir, speed) {
      return {
        x,
        y,
        startX: x,
        startY: y,
        targetX: x,
        targetY: y,
        moveDir: initMoveDir, // +1: 오른쪽 이동/바라봄, -1: 왼쪽 이동/바라봄
        speed,
        state: "idle", // 'walk' | 'crouch_jump' | 'jump_arc' | 'fly' | 'wheel_run' | 'idle' | 'play' | 'rest' | 'react'
        nextActionAfterWalk: null, // 'wheel_run' | 'rest_on_cushion'
        nextActionAfterJump: null, // 'cat_tower_perch' | 'rest_on_cushion'
        playType: 0,
        stateTimer: 2.5 + Math.random() * 3.5,
        walkPhase: Math.random() * 6,
        pauseDuringWalk: 0,
        jumpProgress: 0,
        jumpDuration: 0.48,
        reactTimer: 0,
        userHoldTimer: 0
      };
    }

    /**
     * 이동 방향(moveDir: +1 오른쪽, -1 왼쪽)과 캐릭터 기본 도안 방향(NATURAL_FACING_DIR)을 곱해
     * 진행 방향을 정확히 바라보도록 SVG scaleX 값을 반환합니다.
     */
    getScaleXForDir(itemId, moveDir) {
      const natural = NATURAL_FACING_DIR[itemId] || 1;
      const dir = moveDir >= 0 ? 1 : -1;
      return natural * dir;
    }

    /**
     * 현재 Y 좌표가 3단 가로 창틀(y=54, 122, 190) 위에 있는지 확인하고 해당 창틀 객체를 반환합니다.
     */
    getCurrentWindowBar(x, y, itemId) {
      const bottomOffset = ITEM_BOTTOM_OFFSET[itemId] || 0;
      const footY = y + bottomOffset;
      for (const bar of WINDOW_HORIZONTAL_BARS) {
        if (x >= bar.minX - 6 && x <= bar.maxX + 6 && Math.abs(footY - bar.y) <= 7) {
          return bar;
        }
      }
      return null;
    }

    buildStaticStructure() {
      if (!this.svg) return;

      this.svg.setAttribute(
        "viewBox",
        `${VIEWBOX_MIN_X} ${VIEWBOX_MIN_Y} ${VIEWBOX_W} ${VIEWBOX_H}`
      );
      this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

      const propsHtml = ALL_PROP_IDS
        .map(
          (id) => {
            const isLit = appStorage ? appStorage.getLampLit(id) : true;
            return `
          <g id="prop-${id}" class="draggable-prop" data-item-id="${id}" style="cursor:grab; display:none; touch-action:none; pointer-events:auto;">
            ${getItemLocalSVGMarkup(id, true, isLit)}
          </g>
        `;
          }
        )
        .join("");

      this.svg.innerHTML = `
        <defs>
          ${getSharedLightingDefs()}
          <clipPath id="main_windowGlassClip">
            <rect x="122" y="${WINDOW_TOP_Y}" width="136" height="136" />
          </clipPath>
        </defs>

        <ellipse id="scene-sunbeam" cx="190" cy="245" rx="150" ry="110" fill="url(#sunbeamGrad)" opacity="0" style="pointer-events:none;" />

        <!-- ================= [창밖 풍경 레이어: 4각 창문 유리 안쪽에만 마스킹 (미착용 시 빈 창문)] ================= -->
        <g id="window-view-layer" clip-path="url(#main_windowGlassClip)" style="pointer-events:none;"></g>

        <!-- ================= [상단 중앙: 단일 블랙 라인 4분할 격자 창문 & 연장된 창틀 선반 (상향 보정)] ================= -->
        <g id="window-structure" style="pointer-events:none;">
          <rect x="122" y="${WINDOW_TOP_Y}" width="136" height="136" fill="none" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="miter" />
          <line x1="190" y1="${WINDOW_TOP_Y}" x2="190" y2="${WINDOW_SILL_Y}" stroke="#1F1E1D" stroke-width="1.5" />
          <line x1="122" y1="${WINDOW_MID_Y}" x2="258" y2="${WINDOW_MID_Y}" stroke="#1F1E1D" stroke-width="1.5" />
          <line x1="24" y1="${WINDOW_SILL_Y}" x2="356" y2="${WINDOW_SILL_Y}" stroke="#1F1E1D" stroke-width="1.65" stroke-linecap="round" />
        </g>

        <!-- ================= [1번 뭉게구름 맑은 날 전용: 창살을 넘어 방 안 바닥으로 비추는 은은한 햇살 내림] ================= -->
        <g id="window-sunbeam-layer" style="pointer-events:none;"></g>

        <!-- ================= [드래그 시 3단 가로 창틀(y=24, 92, 160)에만 표시되는 자석 가이드선] ================= -->
        <g id="snap-guides-layer" style="pointer-events:none;">
          <line id="snap-guide-h" x1="24" y1="${WINDOW_SILL_Y}" x2="356" y2="${WINDOW_SILL_Y}" stroke="#D97736" stroke-width="1.75" stroke-dasharray="5 3" opacity="0" />
          <circle id="snap-guide-dot" cx="190" cy="${WINDOW_SILL_Y}" r="3.6" fill="#D97736" opacity="0" />
        </g>

        <!-- ================= [배치 소품 & 동물 친구 레이어 (드래그 앤 드롭 가능)] ================= -->
        ${propsHtml}

        <!-- ================= [손그림 크로키 화풍 강아지 캐릭터 레이어 (하단 그림자 없음)] ================= -->
        <g id="dog-character" class="draggable-prop" data-item-id="living_room_dog" style="cursor:grab; display:none; touch-action:none; pointer-events:auto;">
          ${this.getDuplicateDogMarkup()}
        </g>

        <!-- 동일 아이템 2~3번째 중복 배치 인스턴스 전용 레이어 (독립 드래그/시차 애니메이션/좌우 반전 지원) -->
        <g id="extra-instances-layer"></g>
      `;

      this.syncPositionsFromStorage();
      this.applyPlacedItemsVisibility();
    }

    clientToSvgPoint(clientX, clientY) {
      if (!this.svg) return { x: 190, y: 290 };
      try {
        const ctm = this.svg.getScreenCTM();
        if (ctm) {
          const inv = ctm.inverse();
          return {
            x: clientX * inv.a + clientY * inv.c + inv.e,
            y: clientX * inv.b + clientY * inv.d + inv.f
          };
        }
      } catch (_) {}

      const rect = this.svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: 190, y: 290 };
      const scaleX = VIEWBOX_W / rect.width;
      const scaleY = VIEWBOX_H / rect.height;
      return {
        x: VIEWBOX_MIN_X + (clientX - rect.left) * scaleX,
        y: VIEWBOX_MIN_Y + (clientY - rect.top) * scaleY
      };
    }

    getStageSvgBounds() {
      const stageEl = this.svg?.parentElement;
      if (!stageEl) {
        return { minX: 10, maxX: 370, minY: -36, maxY: 505 };
      }
      const rect = stageEl.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return { minX: 10, maxX: 370, minY: -36, maxY: 505 };
      }

      const marginSidePx = 12;
      const marginTopPx = 10;
      const marginBottomPx = 14;
      const topLeft = this.clientToSvgPoint(
        rect.left + marginSidePx,
        rect.top + marginTopPx
      );
      const bottomRight = this.clientToSvgPoint(
        rect.right - marginSidePx,
        rect.bottom - marginBottomPx
      );

      return {
        minX: Math.min(topLeft.x, bottomRight.x),
        maxX: Math.max(topLeft.x, bottomRight.x),
        minY: Math.min(topLeft.y, bottomRight.y),
        maxY: Math.max(topLeft.y, bottomRight.y)
      };
    }

    getFocusButtonSvgMetrics() {
      const btnIdle = document.getElementById("btn-start-focus");
      const btnPause = document.getElementById("btn-pause-focus");
      const activeBtn =
        this.focusMode === "idle"
          ? btnIdle
          : btnPause && btnPause.offsetParent !== null
          ? btnPause
          : btnIdle;

      if (activeBtn) {
        const r = activeBtn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          const tl = this.clientToSvgPoint(r.left, r.top);
          const br = this.clientToSvgPoint(r.right, r.bottom);
          return {
            topY: Math.round(tl.y),
            bottomY: Math.round(br.y),
            leftX: Math.round(tl.x),
            rightX: Math.round(br.x),
            centerX: Math.round((tl.x + br.x) / 2)
          };
        }
      }

      return {
        topY: 454,
        bottomY: 492,
        leftX: 122,
        rightX: 258,
        centerX: 190
      };
    }

    clampPositionForItem(rawX, rawY, itemId) {
      const bounds = this.getStageSvgBounds();
      const bbox = ITEM_LOCAL_BBOX[itemId] || {
        top: 22,
        bottom: 22,
        left: 22,
        right: 22
      };

      const minX = bounds.minX + bbox.left;
      const maxX = Math.max(minX, bounds.maxX - bbox.right);
      const minY = bounds.minY + bbox.top;
      const maxY = Math.max(minY, bounds.maxY - bbox.bottom);

      return {
        x: Math.max(minX, Math.min(maxX, rawX)),
        y: Math.max(minY, Math.min(maxY, rawY))
      };
    }

    snapAndClampSvgPosition(rawX, rawY, itemId) {
      const clamped = this.clampPositionForItem(rawX, rawY, itemId);
      const x = clamped.x;
      let y = clamped.y;
      let snappedBar = null;

      if (itemId && SILL_SNAP_ENABLED_ITEMS.has(itemId)) {
        const bottomOffset = ITEM_BOTTOM_OFFSET[itemId] || 0;
        const objectBottomY = y + bottomOffset;

        for (const bar of WINDOW_HORIZONTAL_BARS) {
          if (
            x >= bar.minX &&
            x <= bar.maxX &&
            Math.abs(objectBottomY - bar.y) <= bar.threshold
          ) {
            y = bar.y - bottomOffset;
            snappedBar = bar;
            break;
          }
        }
      }

      // 왕관앵무 드래그 시 '포근한 벽면 나뭇가지' 또는 '원목 새 횃대' 가까이 가져가면 나무 윗면 선에 발끝이 딱 맞닿도록 스냅!
      let snappedToPerch = false;
      if (itemId === "cockatiel_bird" && !snappedBar) {
        const footOffset = ITEM_BOTTOM_OFFSET.cockatiel_bird || 1.5;
        const footY = y + footOffset;

        if (this.placedItems.has("wall_wood_branch")) {
          const branchPos = this.getCurrentItemPosition("wall_wood_branch");
          const branchTopY = branchPos.y - 4;
          if (
            Math.abs(x - (branchPos.x - 3)) <= 26 &&
            Math.abs(footY - branchTopY) <= 18
          ) {
            y = branchTopY - footOffset;
            snappedToPerch = true;
          }
        }

        if (!snappedToPerch && this.placedItems.has("wooden_bird_perch")) {
          const perchPos = this.getCurrentItemPosition("wooden_bird_perch");
          const perchTopY = perchPos.y - 52;
          if (
            Math.abs(x - (perchPos.x - 3)) <= 24 &&
            Math.abs(footY - perchTopY) <= 18
          ) {
            y = perchTopY - footOffset;
            snappedToPerch = true;
          }
        }
      }

      const finalClamped = this.clampPositionForItem(x, y, itemId);
      return {
        x: finalClamped.x,
        y: snappedToPerch ? y : finalClamped.y,
        snappedBar
      };
    }

    /**
     * [허공 부양 금지 공통 엔진]
     * 동물별 허용된 착지 가능 지점(4각 창틀 선, 나뭇가지/횃대, 캣타워, 쳇바퀴, 방석, 바닥) 중
     * 현재 좌표(rawX, rawY)에서 가장 가까운 유효 안착 좌표를 반환합니다.
     */
    resolveValidLandingPosition(rawX, rawY, itemId) {
      const clamped = this.clampPositionForItem(rawX, rawY, itemId);
      if (!ALL_LIVING_PETS.has(itemId)) {
        return clamped;
      }

      const bottomOffset = ITEM_BOTTOM_OFFSET[itemId] || 0;
      const btn = this.getFocusButtonSvgMetrics();
      const minFloorAnchorY = FLOOR_MIN_Y - bottomOffset;
      const maxFloorAnchorY = Math.max(minFloorAnchorY + 24, btn.topY - 22 - bottomOffset);

      const hasCushion = this.placedItems.has("beige_cushion");
      const cushionPos = hasCushion ? this.getCurrentItemPosition("beige_cushion") : null;

      // -----------------------------------------------------------------------
      // [1] 지상 전용 동물 (강아지, 웰시코기, 토끼, 거북이, 고슴도치):
      //     창틀 선 아래 바닥 영역과 베이지 방석 위에서만 착지·휴식 허용
      // -----------------------------------------------------------------------
      if (GROUND_ONLY_PETS.has(itemId)) {
        if (cushionPos && cushionPos.y >= 168) {
          const cushY = itemId === "living_room_dog" ? cushionPos.y - 10 : cushionPos.y - 2;
          const cushX = Math.max(cushionPos.x - 22, Math.min(cushionPos.x + 22, clamped.x));
          if (Math.hypot(clamped.x - cushX, clamped.y - cushY) <= 36) {
            return { x: cushX, y: cushY };
          }
        }
        const floorY = Math.max(minFloorAnchorY, Math.min(maxFloorAnchorY, clamped.y));
        return this.clampPositionForItem(clamped.x, floorY, itemId);
      }

      // -----------------------------------------------------------------------
      // [2] 왕관앵무 (비행 동물):
      //     멈춰서 쉬거나 잘 때는 반드시 4각 창틀(윗틀·중간창살·아래창틀), 벽면 나뭇가지, 원목 새 횃대 중 가장 가까운 곳에 발을 붙이고 착지
      // -----------------------------------------------------------------------
      if (itemId === "cockatiel_bird") {
        const perches = [];

        if (this.placedItems.has("wall_wood_branch")) {
          const bp = this.getCurrentItemPosition("wall_wood_branch");
          const bx = Math.max(bp.x - 14, Math.min(bp.x + 8, clamped.x));
          perches.push({ x: bx, y: bp.y - 5.5, exactY: true });
        }
        if (this.placedItems.has("wooden_bird_perch")) {
          const pp = this.getCurrentItemPosition("wooden_bird_perch");
          const px = Math.max(pp.x - 14, Math.min(pp.x + 8, clamped.x));
          perches.push({ x: px, y: pp.y - 53.5, exactY: true });
        }
        for (const bar of WINDOW_HORIZONTAL_BARS) {
          const bx = Math.max(bar.walkMinX, Math.min(bar.walkMaxX, clamped.x));
          perches.push({ x: bx, y: bar.y - bottomOffset, exactY: false });
        }

        let best = perches[0];
        let bestDist = Infinity;
        for (const p of perches) {
          const d = Math.hypot(p.x - clamped.x, p.y - clamped.y);
          if (d < bestDist) {
            bestDist = d;
            best = p;
          }
        }

        const safeX = this.clampPositionForItem(best.x, best.y, itemId).x;
        return {
          x: safeX,
          y: best.exactY ? best.y : this.clampPositionForItem(safeX, best.y, itemId).y
        };
      }

      // -----------------------------------------------------------------------
      // [3] 고양이 2종 & 햄스터 (CLIMBER_PETS):
      //     바닥 영역 + 4각 창틀(윗틀·중간창살·아래창틀) + 전용 가구(캣타워, 방석, 쳇바퀴)
      // -----------------------------------------------------------------------
      const candidates = [];

      // 3-A. 4각 창틀 3단 가로선 (발끝/배 밑선이 창틀 선에 정확히 맞닿도록 y = bar.y - bottomOffset)
      for (const bar of WINDOW_HORIZONTAL_BARS) {
        const bx = Math.max(bar.walkMinX, Math.min(bar.walkMaxX, clamped.x));
        candidates.push({ x: bx, y: bar.y - bottomOffset });
      }

      // 3-B. 고양이 전용: 미니 원목 캣타워 2·3단 발판
      if (
        (itemId === "window_cat" || itemId === "tuxedo_cat") &&
        this.placedItems.has("mini_cat_tower")
      ) {
        const tp = this.getCurrentItemPosition("mini_cat_tower");
        candidates.push({ x: tp.x - 9, y: tp.y - 94 });
        candidates.push({ x: tp.x + 14, y: tp.y - 62 });
        candidates.push({ x: tp.x - 16, y: tp.y - 58 });
      }

      // 3-C. 햄스터 전용: 우드 햄스터 쳇바퀴
      if (itemId === "hamster_friend" && this.placedItems.has("hamster_wheel")) {
        const wp = this.getCurrentItemPosition("hamster_wheel");
        if (Math.hypot(clamped.x - wp.x, clamped.y - (wp.y - 13)) <= 32) {
          candidates.push({ x: wp.x, y: wp.y - 13 });
        }
      }

      // 3-D. 베이지 방석
      if (cushionPos && cushionPos.y >= 168) {
        const cx = Math.max(cushionPos.x - 22, Math.min(cushionPos.x + 22, clamped.x));
        candidates.push({ x: cx, y: cushionPos.y - 2 });
      }

      // 3-E. 바닥 영역 (이미 바닥에 있으면 그 자리 유지, 벽 허공이면 바닥 시작선 후보 추가)
      const floorY = Math.max(minFloorAnchorY, Math.min(maxFloorAnchorY, clamped.y));
      candidates.push({ x: clamped.x, y: floorY });

      let best = candidates[0];
      let bestDist = Infinity;
      for (const c of candidates) {
        const d = Math.hypot(c.x - clamped.x, c.y - clamped.y);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }

      return this.clampPositionForItem(best.x, best.y, itemId);
    }

    /**
     * 현재 동물이 빈 벽 허공이 아닌 유효한 지지대(창틀/가구/바닥) 위에 안착해 있는지 검사합니다.
     */
    isOnValidRestingSurface(x, y, itemId) {
      if (!ALL_LIVING_PETS.has(itemId)) return true;
      const resolved = this.resolveValidLandingPosition(x, y, itemId);
      return Math.hypot(resolved.x - x, resolved.y - y) <= 4.5;
    }

    updateSnapGuidesVisual(snappedBar, curX) {
      if (!this.svg) return;
      const guideH = this.svg.querySelector("#snap-guide-h");
      const guideDot = this.svg.querySelector("#snap-guide-dot");

      if (guideH) {
        if (snappedBar) {
          guideH.setAttribute("x1", String(snappedBar.guideX1));
          guideH.setAttribute("x2", String(snappedBar.guideX2));
          guideH.setAttribute("y1", String(snappedBar.y));
          guideH.setAttribute("y2", String(snappedBar.y));
          guideH.setAttribute("opacity", "0.92");
        } else {
          guideH.setAttribute("opacity", "0");
        }
      }

      if (guideDot) {
        if (snappedBar) {
          guideDot.setAttribute("cx", String(curX));
          guideDot.setAttribute("cy", String(snappedBar.y));
          guideDot.setAttribute("opacity", "0.95");
        } else {
          guideDot.setAttribute("opacity", "0");
        }
      }
    }

    applyLampLitVisual(isLit, itemId = "stand_lamp") {
      const lit = Boolean(isLit);
      if (itemId === "stand_lamp") {
        this.lampLit = lit;
      }
      if (!this.svg) return;

      const roots = this.svg.querySelectorAll(`[data-item-id="${itemId}"]`);
      if (!roots || roots.length === 0) return;

      roots.forEach((root) => {
        if (itemId === "stand_lamp") {
          const glowGroup = root.querySelector('[data-part="lamp-glow-group"]');
          const shadePath = root.querySelector('[data-part="lamp-shade-path"]');
          if (glowGroup) glowGroup.style.opacity = lit ? "1" : "0";
          if (shadePath) shadePath.setAttribute("fill", lit ? "#FFECB8" : "#FEF9F1");
          return;
        }

        const glowEl = root.querySelector(`[data-part="light-glow-${itemId}"]`);
        if (glowEl) {
          glowEl.style.opacity = lit ? "1" : "0";
        }

        if (itemId === "cloud_wall_lamp") {
          const body = root.querySelector('[data-part="light-body-cloud_wall_lamp"]');
          if (body) body.setAttribute("fill", lit ? "#FFF3C8" : "#FEF9F1");
        } else if (itemId === "crescent_mood_lamp") {
          const body = root.querySelector('[data-part="light-body-crescent_mood_lamp"]');
          if (body) body.setAttribute("fill", lit ? "#FFE79B" : "#FEF9F1");
        } else if (itemId === "mushroom_stand_lamp") {
          const body = root.querySelector('[data-part="light-body-mushroom_stand_lamp"]');
          if (body) body.setAttribute("fill", lit ? "#FFECB8" : "#FEF9F1");
        } else if (itemId === "starlight_garland") {
          const bulbsGroup = root.querySelector('[data-part="light-bulbs-starlight_garland"]');
          bulbsGroup?.querySelectorAll(".garland-bulb").forEach((b) => {
            b.setAttribute("fill", lit ? "#FFE688" : "#FEF9F1");
          });
        } else if (itemId === "aroma_candle") {
          const flame = root.querySelector('[data-part="candle-flame-aroma_candle"]');
          if (flame) flame.style.display = lit ? "block" : "none";
        }
      });
    }

    syncAllLightsFromStorage() {
      if (!appStorage) return;
      LIGHT_ITEM_IDS.forEach((id) => {
        this.applyLampLitVisual(appStorage.getLampLit(id), id);
      });
    }

    getCurrentItemPosition(itemId) {
      if (itemId === "living_room_dog") {
        return { x: this.dog.x, y: this.dog.baseY };
      }
      if (this.animals[itemId]) {
        return { x: this.animals[itemId].x, y: this.animals[itemId].y };
      }
      return appStorage.getItemPosition(itemId);
    }

    bindDragAndTapEvents() {
      if (!this.svg) return;

      // 1번 원본 개체만 바인딩 (.extra-instance-prop 복제 개체는 bindExtraInstanceDrag에서 instanceId 기준으로 단독 처리)
      this.svg.querySelectorAll(".draggable-prop:not(.extra-instance-prop)").forEach((el) => {
        el.addEventListener("pointerdown", (e) => {
          if (e.button && e.button !== 0) return;
          e.stopPropagation();

          const itemId = el.getAttribute("data-item-id");
          if (!itemId || !this.placedItems.has(itemId)) return;

          try {
            el.setPointerCapture(e.pointerId);
          } catch (_) {}

          const curPos = this.getCurrentItemPosition(itemId);
          const startSvg = this.clientToSvgPoint(e.clientX, e.clientY);

          this.dragState = {
            pointerId: e.pointerId,
            itemId,
            isExtraInstance: false,
            el,
            startClientX: e.clientX,
            startClientY: e.clientY,
            startSvgX: startSvg.x,
            startSvgY: startSvg.y,
            originX: curPos.x,
            originY: curPos.y,
            currentX: curPos.x,
            currentY: curPos.y,
            snappedBar: null,
            isDragging: false
          };

          el.style.cursor = "grabbing";
        });

        el.addEventListener("pointermove", (e) => {
          if (
            !this.dragState ||
            this.dragState.isExtraInstance ||
            this.dragState.el !== el ||
            this.dragState.pointerId !== e.pointerId
          ) {
            return;
          }

          const distPx = Math.hypot(
            e.clientX - this.dragState.startClientX,
            e.clientY - this.dragState.startClientY
          );

          if (!this.dragState.isDragging && distPx >= 5) {
            this.dragState.isDragging = true;
            this.hideSpeechBubble();
          }

          if (this.dragState.isDragging) {
            const curSvg = this.clientToSvgPoint(e.clientX, e.clientY);
            const rawX = this.dragState.originX + (curSvg.x - this.dragState.startSvgX);
            const rawY = this.dragState.originY + (curSvg.y - this.dragState.startSvgY);
            const snapped = this.snapAndClampSvgPosition(
              rawX,
              rawY,
              this.dragState.itemId
            );

            const dx = snapped.x - this.dragState.currentX;
            this.dragState.currentX = snapped.x;
            this.dragState.currentY = snapped.y;
            this.dragState.snappedBar = snapped.snappedBar;

            this.updateSnapGuidesVisual(snapped.snappedBar, snapped.x);

            const id = this.dragState.itemId;
            if (id === "living_room_dog") {
              this.dog.x = snapped.x;
              this.dog.baseY = snapped.y;
              this.dog.y = snapped.y;
              this.dog.targetX = snapped.x;
              this.dog.targetY = snapped.y;
              if (Math.abs(dx) > 0.8) this.dog.moveDir = dx > 0 ? 1 : -1;
              this.dog.state = "idle";
              el.setAttribute(
                "transform",
                `translate(${snapped.x.toFixed(1)}, ${snapped.y.toFixed(1)})`
              );
            } else if (this.animals[id]) {
              const a = this.animals[id];
              a.x = snapped.x;
              a.y = snapped.y;
              a.targetX = snapped.x;
              a.targetY = snapped.y;
              if (Math.abs(dx) > 0.8 && a.moveDir !== undefined) {
                a.moveDir = dx > 0 ? 1 : -1;
              }
              if (id !== "goldfish_bowl") {
                a.state = "idle";
                a.jumpProgress = 0;
              }
              el.setAttribute(
                "transform",
                `translate(${snapped.x.toFixed(1)}, ${snapped.y.toFixed(1)})`
              );
            } else {
              el.setAttribute(
                "transform",
                `translate(${snapped.x.toFixed(1)}, ${snapped.y.toFixed(1)})`
              );
            }
          }
        });

        const finishPointer = (e) => {
          if (
            !this.dragState ||
            this.dragState.isExtraInstance ||
            this.dragState.el !== el ||
            this.dragState.pointerId !== e.pointerId
          ) {
            return;
          }
          const state = this.dragState;
          this.dragState = null;

          this.updateSnapGuidesVisual(null, 0);

          try {
            el.releasePointerCapture(e.pointerId);
          } catch (_) {}
          el.style.cursor = "grab";

          if (state.isDragging) {
            if (ALL_LIVING_PETS.has(state.itemId)) {
              const landPos = this.resolveValidLandingPosition(
                state.currentX,
                state.currentY,
                state.itemId
              );
              appStorage.setItemPosition(state.itemId, landPos.x, landPos.y);
              const snapDist = Math.hypot(
                landPos.x - state.currentX,
                landPos.y - state.currentY
              );

              if (state.itemId === "living_room_dog") {
                this.dog.nextActionAfterWalk = null;
                this.dog.userHoldTimer = 2.0;
                if (snapDist > 2) {
                  this.dog.settleActive = true;
                  this.dog.settleStartX = state.currentX;
                  this.dog.settleStartY = state.currentY;
                  this.dog.settleTargetX = landPos.x;
                  this.dog.settleTargetY = landPos.y;
                  this.dog.settleProgress = 0;
                  this.dog.state = "idle";
                  this.dog.stateTimer = 2.5 + Math.random() * 2.0;
                } else {
                  this.dog.x = landPos.x;
                  this.dog.baseY = landPos.y;
                  this.dog.y = landPos.y;
                  this.dog.targetX = landPos.x;
                  this.dog.targetY = landPos.y;
                  this.dog.settleActive = false;
                  this.dog.state = "idle";
                  this.dog.stateTimer = 2.5 + Math.random() * 2.0;
                }
              } else if (this.animals[state.itemId]) {
                const a = this.animals[state.itemId];
                a.nextActionAfterWalk = null;
                a.nextActionAfterJump = null;
                a.userHoldTimer = 2.0;
                if (snapDist > 2) {
                  a.startX = state.currentX;
                  a.startY = state.currentY;
                  a.targetX = landPos.x;
                  a.targetY = landPos.y;
                  if (Math.abs(landPos.x - state.currentX) > 2) {
                    a.moveDir = landPos.x >= state.currentX ? 1 : -1;
                  }
                  a.jumpProgress = 0;
                  a.jumpDuration = state.itemId === "cockatiel_bird" ? 0.42 : 0.32;
                  a.state = state.itemId === "cockatiel_bird" ? "fly" : "jump_arc";
                } else {
                  a.x = landPos.x;
                  a.y = landPos.y;
                  a.targetX = landPos.x;
                  a.targetY = landPos.y;
                  a.state = "idle";
                  a.stateTimer = 2.5 + Math.random() * 2.0;
                }
              }
            } else {
              appStorage.setItemPosition(state.itemId, state.currentX, state.currentY);
            }
          } else {
            if (state.itemId === "living_room_dog") {
              this.triggerDogInteraction(null, el);
            } else {
              this.triggerPropInteraction(state.itemId, el);
            }
          }
        };

        el.addEventListener("pointerup", finishPointer);
        el.addEventListener("pointercancel", finishPointer);
      });
    }

    syncPositionsFromStorage() {
      if (!this.svg || !appStorage) return;

      this.syncAllLightsFromStorage();

      // 벽면 나뭇가지 및 원목 새 횃대 위치를 먼저 읽어 왕관앵무 초기/배치 착지 좌표를 정확히 정렬
      const branchStored = this.placedItems.has("wall_wood_branch")
        ? this.clampPositionForItem(
            appStorage.getItemPosition("wall_wood_branch").x,
            appStorage.getItemPosition("wall_wood_branch").y,
            "wall_wood_branch"
          )
        : null;
      const perchStored = this.placedItems.has("wooden_bird_perch")
        ? this.clampPositionForItem(
            appStorage.getItemPosition("wooden_bird_perch").x,
            appStorage.getItemPosition("wooden_bird_perch").y,
            "wooden_bird_perch"
          )
        : null;

      ALL_PROP_IDS.forEach((id) => {
        const el = this.svg.querySelector(`#prop-${id}`);
        if (!el) return;
        const rawPos = appStorage.getItemPosition(id);
        let pos = this.clampPositionForItem(rawPos.x, rawPos.y, id);

        // 기존에 화면 최상단 경계까지 끌려 올라간 벽면 나뭇가지가 있다면 앵무새 착지 공간이 확보된 클램프 좌표로 동기화
        if (id === "wall_wood_branch" && (Math.abs(pos.x - rawPos.x) > 0.5 || Math.abs(pos.y - rawPos.y) > 0.5)) {
          appStorage.setItemPosition("wall_wood_branch", pos.x, pos.y);
        }

        // 왕관앵무가 나뭇가지나 횃대와 겹쳐 있거나 함께 배치된 경우, 나무 윗면 선(발바닥 기준)에 정확히 올라앉도록 보정
        if (id === "cockatiel_bird" && this.placedItems.has("cockatiel_bird")) {
          if (
            branchStored &&
            (Math.hypot(rawPos.x - branchStored.x, rawPos.y - branchStored.y) <= 65 ||
              (Math.abs(rawPos.x - 158) <= 2 && Math.abs(rawPos.y - 122) <= 2))
          ) {
            const clampedX = this.clampPositionForItem(
              branchStored.x - 3,
              branchStored.y,
              "cockatiel_bird"
            ).x;
            pos = { x: clampedX, y: branchStored.y - 5.5 };
          } else if (
            perchStored &&
            Math.hypot(rawPos.x - perchStored.x, rawPos.y - (perchStored.y - 52)) <= 45
          ) {
            const clampedX = this.clampPositionForItem(
              perchStored.x - 3,
              perchStored.y,
              "cockatiel_bird"
            ).x;
            pos = { x: clampedX, y: perchStored.y - 53.5 };
          }
        }

        // 모든 살아있는 동물이 빈 벽 허공에 떠 있지 않고 유효한 지지대(창틀·나뭇가지·횃대·캣타워·방석·바닥)에 안착하도록 보정
        if (ALL_LIVING_PETS.has(id) && this.placedItems.has(id)) {
          const landed = this.resolveValidLandingPosition(pos.x, pos.y, id);
          pos = landed;
        }

        if (this.animals[id]) {
          const a = this.animals[id];
          const isPlacedNow = this.placedItems.has(id);
          if (!isPlacedNow) {
            this.initializedAnimalPositions.delete(id);
          } else if (!this.initializedAnimalPositions.has(id)) {
            this.initializedAnimalPositions.add(id);
            a.x = pos.x;
            a.y = pos.y;
            if (a.targetX !== undefined) a.targetX = pos.x;
            if (a.targetY !== undefined) a.targetY = pos.y;
            el.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);
          }
          return;
        }
        if (this.dragState && this.dragState.isDragging && this.dragState.itemId === id) {
          return;
        }
        el.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);
      });

      const hasDog = this.placedItems.has("living_room_dog");
      if (!hasDog) {
        this.initializedAnimalPositions.delete("living_room_dog");
      } else if (!this.initializedAnimalPositions.has("living_room_dog")) {
        const rawDogPos = appStorage.getItemPosition("living_room_dog");
        const dogPos = this.resolveValidLandingPosition(
          rawDogPos.x,
          rawDogPos.y,
          "living_room_dog"
        );
        this.initializedAnimalPositions.add("living_room_dog");
        this.dog.x = dogPos.x;
        this.dog.baseY = dogPos.y;
        this.dog.y = dogPos.y;
        this.dog.targetX = dogPos.x;
        this.dog.targetY = dogPos.y;
      }
    }

    setPlacedItems(placedItemIds) {
      const prevHadDog = this.placedItems.has("living_room_dog");
      this.placedItems = new Set(placedItemIds || []);
      if (!prevHadDog && this.placedItems.has("living_room_dog")) {
        const dogPos = appStorage.getItemPosition("living_room_dog");
        this.dog.x = dogPos.x;
        this.dog.baseY = dogPos.y;
        this.dog.y = dogPos.y;
      }
      this.syncPositionsFromStorage();
      this.applyPlacedItemsVisibility();
    }

    applyPlacedItemsVisibility() {
      if (!this.svg) return;

      const viewLayer = this.svg.querySelector("#window-view-layer");
      const sunbeamLayer = this.svg.querySelector("#window-sunbeam-layer");
      const activeViewId = getActiveWindowViewFromPlaced(this.placedItems);
      if (this.currentWindowViewId !== activeViewId) {
        this.currentWindowViewId = activeViewId;
        if (viewLayer) {
          viewLayer.innerHTML = activeViewId
            ? getWindowViewSVGMarkup(activeViewId, "main_", true)
            : "";
        }
        if (sunbeamLayer) {
          sunbeamLayer.innerHTML = getWindowSunbeamOverlayMarkup(activeViewId, "main_", true);
        }
      }

      ALL_PROP_IDS.forEach((id) => {
        const el = this.svg.querySelector(`#prop-${id}`);
        if (el) {
          el.style.display = this.placedItems.has(id) ? "block" : "none";
        }
      });

      const dogEl = this.svg.querySelector("#dog-character");
      if (dogEl) {
        dogEl.style.display = this.placedItems.has("living_room_dog") ? "block" : "none";
      }

      this.renderExtraInstances();
    }

    getDuplicateDogMarkup() {
      return `
        <g data-part="dog-visual">
          <!-- [A] 걷기 / 대기 / 배 깔고 앞발 꼼지락 / 기지개 포즈 그룹 -->
          <g data-part="dog-pose-active">
            <g data-part="dog-body-anim-wrap">
              <line data-part="dog-leg-bl" x1="-12" y1="4" x2="-14" y2="17" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
              <line data-part="dog-leg-br" x1="-6" y1="4" x2="-4" y2="17" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
              <line data-part="dog-leg-fl" x1="10" y1="4" x2="8" y2="17" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
              <line data-part="dog-leg-fr" x1="16" y1="4" x2="18" y2="17" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />

              <path data-part="dog-tail" d="M-19 -6 C-27 -12, -29 -19, -23 -21" fill="none" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />

              <path data-part="dog-torso" d="M-20 -4 C-21 -14, -8 -16, 8 -14 C18 -13, 22 -5, 20 3 C18 8, -17 8, -20 -4 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.75" stroke-linejoin="round" />

              <g data-part="dog-head" transform="translate(18, -14)">
                <circle cx="2" cy="-2" r="12.5" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.75" />
                <path data-part="dog-ear" d="M-5 -10 C-11 -9, -13 1, -7 4 C-3 5, -2 -3, -4 -8" fill="#EAE0D0" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
                <circle data-part="dog-eye" cx="7" cy="-4" r="1.7" fill="#1F1E1D" />
                <ellipse cx="14" cy="-1.5" rx="2.5" ry="1.9" fill="#1F1E1D" />
                <path d="M10 2.5 Q12 5 14 2.5" fill="none" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round" />
                <ellipse cx="5" cy="1" rx="2.8" ry="1.6" fill="#F2B8A2" opacity="0.7" />
              </g>

              <path d="M10 -12 C12 -6, 16 -4, 19 -5" fill="none" stroke="#D97736" stroke-width="2" stroke-linecap="round" />
              <circle cx="16" cy="-4" r="2.2" fill="#F4C065" stroke="#1F1E1D" stroke-width="1.1" />
            </g>
          </g>

          <!-- [B] 휴식(rest) 및 집중 진행 시 동그랗게 웅크려 잠자는 포즈 그룹 -->
          <g data-part="dog-pose-sleep" style="display:none;">
            <path d="M-24 12 C-26 -2, -12 -10, 8 -9 C23 -8, 29 2, 25 12 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.75" stroke-linejoin="round" />
            <path d="M4 12 C2 2, 9 -5, 19 -4 C27 -3, 30 5, 26 12 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.75" />
            <path d="M10 -2 C5 0, 5 9, 10 10 C14 10, 14 2, 10 -2 Z" fill="#EAE0D0" stroke="#1F1E1D" stroke-width="1.6" />
            <path d="M18 3 Q21 5.5 24 3" fill="none" stroke="#1F1E1D" stroke-width="1.5" stroke-linecap="round" />
            <circle cx="27.5" cy="6" r="2" fill="#1F1E1D" />
            <ellipse cx="18" cy="7" rx="2.8" ry="1.5" fill="#F2B8A2" opacity="0.75" />
            <path d="M-23 9 C-29 7, -30 2, -25 1" fill="none" stroke="#1F1E1D" stroke-width="1.7" stroke-linecap="round" />
          </g>
        </g>
        <g data-part="dog-sleep-zzz" style="display:none;">
          <text x="26" y="-10" fill="#1F1E1D" font-size="10" font-weight="600" font-family="sans-serif">z</text>
          <text x="34" y="-19" fill="#D97736" font-size="13" font-weight="700" font-family="sans-serif">Z</text>
        </g>
      `;
    }

    renderExtraInstances() {
      const layer = this.svg?.querySelector("#extra-instances-layer");
      if (!layer || !appStorage || typeof appStorage.getPlacedInstances !== "function") return;

      const allInstances = appStorage.getPlacedInstances();
      const seenCountByItem = {};
      const extraInstances = [];

      allInstances.forEach((inst) => {
        const count = seenCountByItem[inst.itemId] || 0;
        seenCountByItem[inst.itemId] = count + 1;
        if (count >= 1) {
          extraInstances.push({ inst, copyIndex: count });
        }
      });

      // 기존 DOM 노드를 불변 instanceId 키로 인덱싱해 애니메이션 초기화(innerHTML 전체 재생성) 방지
      const existingById = new Map();
      Array.from(layer.children).forEach((child) => {
        const id = child.getAttribute("data-instance-id");
        if (id) existingById.set(id, child);
      });

      const activeIds = new Set(extraInstances.map(({ inst }) => inst.instanceId));
      existingById.forEach((node, id) => {
        if (!activeIds.has(id)) {
          node.remove();
          existingById.delete(id);
          this.extraAnimalStates.delete(id);
        }
      });
      this.extraAnimalStates.forEach((_, id) => {
        if (!activeIds.has(id)) {
          this.extraAnimalStates.delete(id);
        }
      });

      const EXTRA_PET_SPEEDS = {
        living_room_dog: 52,
        window_cat: 34,
        tuxedo_cat: 34,
        hamster_friend: 50,
        cockatiel_bird: 40,
        welsh_corgi: 64,
        little_turtle: 12,
        hedgehog_friend: 30,
        white_rabbit: 46
      };

      const SVG_NS = "http://www.w3.org/2000/svg";

      extraInstances.forEach(({ inst, copyIndex }) => {
        const isPet = ALL_LIVING_PETS.has(inst.itemId);
        const isMovingPet = isPet && inst.itemId !== "goldfish_bowl";
        const isLit = appStorage.getLampLit(inst.itemId);
        const isCurrentlyDragging =
          this.dragState &&
          this.dragState.isExtraInstance &&
          this.dragState.isDragging &&
          this.dragState.instanceId === inst.instanceId;

        const existingEl = existingById.get(inst.instanceId);
        if (existingEl) {
          // 자율 이동 중인 복제 동물은 실시간 좌표를 유지하고, 정적 소품·어항만 저장 좌표 동기화
          if (!isCurrentlyDragging && !(isMovingPet && this.extraAnimalStates.has(inst.instanceId))) {
            const nextTransform = `translate(${inst.x}, ${inst.y})`;
            if (existingEl.getAttribute("transform") !== nextTransform) {
              existingEl.setAttribute("transform", nextTransform);
            }
          }
          // 조명 점등 상태가 바뀐 경우에만 내부 마크업 갱신
          if (existingEl.dataset.lampLit !== String(isLit)) {
            existingEl.dataset.lampLit = String(isLit);
            const innerEl = existingEl.querySelector(".extra-instance-inner");
            if (innerEl) {
              innerEl.innerHTML =
                inst.itemId === "living_room_dog"
                  ? this.getDuplicateDogMarkup()
                  : getItemLocalSVGMarkup(inst.itemId, false, isLit);
            }
          }
          return;
        }

        const flipSign = isPet && inst.flipX ? -1 : 1;
        const innerMarkup =
          inst.itemId === "living_room_dog"
            ? this.getDuplicateDogMarkup()
            : getItemLocalSVGMarkup(inst.itemId, false, isLit);

        const initPos = isMovingPet
          ? this.resolveValidLandingPosition(inst.x, inst.y, inst.itemId)
          : { x: inst.x, y: inst.y };

        const groupEl = document.createElementNS(SVG_NS, "g");
        groupEl.setAttribute("class", "draggable-prop extra-instance-prop");
        groupEl.setAttribute("data-item-id", inst.itemId);
        groupEl.setAttribute("data-instance-id", inst.instanceId);
        groupEl.setAttribute("transform", `translate(${initPos.x}, ${initPos.y})`);
        groupEl.style.cursor = "grab";
        groupEl.style.touchAction = "none";
        groupEl.style.pointerEvents = "all";
        groupEl.dataset.lampLit = String(isLit);

        // 모바일 손가락 터치 시 얇은 선화 소품도 안정적으로 잡히도록 투명 히트 영역 추가
        const hitAreaEl = document.createElementNS(SVG_NS, "circle");
        hitAreaEl.setAttribute("class", "extra-hit-area");
        hitAreaEl.setAttribute("cx", "0");
        hitAreaEl.setAttribute("cy", "-6");
        hitAreaEl.setAttribute("r", "22");
        hitAreaEl.setAttribute("fill", "rgba(0,0,0,0)");
        hitAreaEl.setAttribute("pointer-events", "all");

        const innerEl = document.createElementNS(SVG_NS, "g");
        innerEl.setAttribute("class", "extra-instance-inner");
        innerEl.innerHTML = innerMarkup;

        groupEl.appendChild(hitAreaEl);
        groupEl.appendChild(innerEl);
        layer.appendChild(groupEl);
        this.bindExtraInstanceDrag(groupEl);

        // 복제 동물(이동형·고정형 전 종 포함) 고유 instanceId 기반 독립 상태 초기화
        if (isPet && !this.extraAnimalStates.has(inst.instanceId)) {
          if (inst.itemId === "goldfish_bowl") {
            this.extraAnimalStates.set(inst.instanceId, {
              itemId: "goldfish_bowl",
              instanceId: inst.instanceId,
              x: initPos.x,
              y: initPos.y,
              state: "walk",
              stateTimer: 1.8 + copyIndex * 1.1 + Math.random() * 2.5,
              swimPhase: Math.random() * Math.PI * 2 + copyIndex * 2.1,
              bubbleTimer: 0,
              animSeed: Math.random() * Math.PI * 2,
              el: groupEl,
              innerEl
            });
          } else if (inst.itemId === "living_room_dog") {
            this.extraAnimalStates.set(inst.instanceId, {
              itemId: "living_room_dog",
              instanceId: inst.instanceId,
              x: initPos.x,
              baseY: initPos.y,
              y: initPos.y,
              targetX: initPos.x,
              targetY: initPos.y,
              moveDir: flipSign,
              state: "idle",
              stateTimer: 0.7 + copyIndex * 0.9 + Math.random() * 1.5,
              playSubMode: Math.random() < 0.5 ? "patter" : "bow",
              walkCycle: Math.random() * 6,
              tailPhase: Math.random() * 6,
              blinkTimer: 1.5 + Math.random() * 3.0,
              reactTimer: 0,
              userHoldTimer: 0,
              settleActive: false,
              settleStartX: initPos.x,
              settleStartY: initPos.y,
              settleTargetX: initPos.x,
              settleTargetY: initPos.y,
              settleProgress: 0,
              animSeed: Math.random() * Math.PI * 2 + copyIndex * 1.7,
              el: groupEl,
              innerEl
            });
          } else {
            const speed = (EXTRA_PET_SPEEDS[inst.itemId] || 42) * (0.9 + Math.random() * 0.22);
            const aiState = this.createAnimalState(initPos.x, initPos.y, flipSign, speed);
            aiState.itemId = inst.itemId;
            aiState.instanceId = inst.instanceId;
            aiState.animSeed = Math.random() * Math.PI * 2 + copyIndex * 1.9;
            aiState.stateTimer = 0.6 + copyIndex * 0.85 + Math.random() * 1.4;
            aiState.userHoldTimer = 0;
            aiState.reactTimer = 0;
            aiState.el = groupEl;
            aiState.innerEl = innerEl;
            this.extraAnimalStates.set(inst.instanceId, aiState);
          }
        }
      });
    }

    bindExtraInstanceDrag(el) {
      if (!el || el.dataset.extraDragBound === "1") return;
      el.dataset.extraDragBound = "1";

      el.addEventListener("pointerdown", (e) => {
        if (e.button && e.button !== 0) return;
        e.stopPropagation();

        const itemId = el.getAttribute("data-item-id");
        const instanceId = el.getAttribute("data-instance-id");
        if (!itemId || !instanceId) return;

        try {
          el.setPointerCapture(e.pointerId);
        } catch (_) {}

        const liveState = this.extraAnimalStates.get(instanceId);
        const curPos = liveState
          ? { x: liveState.x, y: liveState.y }
          : appStorage.getInstancePosition(instanceId);
        const startSvg = this.clientToSvgPoint(e.clientX, e.clientY);

        this.dragState = {
          pointerId: e.pointerId,
          itemId,
          instanceId,
          isExtraInstance: true,
          el,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startSvgX: startSvg.x,
          startSvgY: startSvg.y,
          originX: curPos.x,
          originY: curPos.y,
          currentX: curPos.x,
          currentY: curPos.y,
          snappedBar: null,
          isDragging: false
        };

        el.style.cursor = "grabbing";
      });

      el.addEventListener("pointermove", (e) => {
        const instanceId = el.getAttribute("data-instance-id");
        if (
          !this.dragState ||
          !this.dragState.isExtraInstance ||
          this.dragState.instanceId !== instanceId ||
          this.dragState.pointerId !== e.pointerId
        ) {
          return;
        }

        const distPx = Math.hypot(
          e.clientX - this.dragState.startClientX,
          e.clientY - this.dragState.startClientY
        );

        if (!this.dragState.isDragging && distPx >= 5) {
          this.dragState.isDragging = true;
          this.hideSpeechBubble();
        }

        if (this.dragState.isDragging) {
          const curSvg = this.clientToSvgPoint(e.clientX, e.clientY);
          const rawX = this.dragState.originX + (curSvg.x - this.dragState.startSvgX);
          const rawY = this.dragState.originY + (curSvg.y - this.dragState.startSvgY);
          const snapped = this.snapAndClampSvgPosition(rawX, rawY, this.dragState.itemId);

          const dx = snapped.x - this.dragState.currentX;
          this.dragState.currentX = snapped.x;
          this.dragState.currentY = snapped.y;
          this.dragState.snappedBar = snapped.snappedBar;

          const liveState = this.extraAnimalStates.get(instanceId);
          if (liveState) {
            liveState.x = snapped.x;
            liveState.y = snapped.y;
            if (liveState.baseY !== undefined) liveState.baseY = snapped.y;
            liveState.targetX = snapped.x;
            liveState.targetY = snapped.y;
            liveState.state = "idle";
            if (Math.abs(dx) > 0.8) {
              liveState.moveDir = dx > 0 ? 1 : -1;
            }
          }

          this.updateSnapGuidesVisual(snapped.snappedBar, snapped.x);
          el.setAttribute("transform", `translate(${snapped.x.toFixed(1)}, ${snapped.y.toFixed(1)})`);
        }
      });

      const finishExtraPointer = (e) => {
        const instanceId = el.getAttribute("data-instance-id");
        if (
          !this.dragState ||
          !this.dragState.isExtraInstance ||
          this.dragState.instanceId !== instanceId ||
          this.dragState.pointerId !== e.pointerId
        ) {
          return;
        }
        const state = this.dragState;
        this.dragState = null;

        this.updateSnapGuidesVisual(null, 0);
        try {
          el.releasePointerCapture(e.pointerId);
        } catch (_) {}
        el.style.cursor = "grab";

        if (state.isDragging) {
          if (ALL_LIVING_PETS.has(state.itemId)) {
            const landPos = this.resolveValidLandingPosition(
              state.currentX,
              state.currentY,
              state.itemId
            );
            const liveState = this.extraAnimalStates.get(state.instanceId);
            if (liveState) {
              liveState.x = landPos.x;
              liveState.y = landPos.y;
              if (liveState.baseY !== undefined) liveState.baseY = landPos.y;
              liveState.targetX = landPos.x;
              liveState.targetY = landPos.y;
              liveState.userHoldTimer = 2.0;
              liveState.state = "idle";
              liveState.stateTimer = 2.0 + Math.random() * 2.0;
            }
            el.setAttribute("transform", `translate(${landPos.x.toFixed(1)}, ${landPos.y.toFixed(1)})`);
            appStorage.setInstancePosition(state.instanceId, landPos.x, landPos.y);
          } else {
            appStorage.setInstancePosition(state.instanceId, state.currentX, state.currentY);
          }
        } else {
          if (state.itemId === "living_room_dog") {
            this.triggerDogInteraction(null, el);
          } else {
            this.triggerPropInteraction(state.itemId, el);
          }
        }
      };

      el.addEventListener("pointerup", finishExtraPointer);
      el.addEventListener("pointercancel", finishExtraPointer);
    }

    setFocusMode(mode) {
      this.focusMode = mode;
      const sunbeam = this.svg?.querySelector("#scene-sunbeam");

      if (mode === "running") {
        if (this.placedItems.has("beige_cushion")) {
          const cushionPos = appStorage.getItemPosition("beige_cushion");
          this.dog.targetX = cushionPos.x;
          this.dog.targetY = cushionPos.y - 10;
        }
        this.dog.state = "rest";
        if (sunbeam) sunbeam.setAttribute("opacity", "1");
      } else {
        if (this.dog.state === "rest") {
          this.dog.state = "idle";
          this.dog.stateTimer = 2.0;
        }
        if (sunbeam) sunbeam.setAttribute("opacity", "0");
      }
    }

    triggerDogInteraction(customText = null, targetEl = null) {
      if (!this.placedItems.has("living_room_dog")) return;
      audioEngine.playPetReactionSound("bark");

      const dogEl = targetEl || this.svg?.querySelector("#dog-character");
      const instId = dogEl?.getAttribute?.("data-instance-id") || null;
      const isPrimaryDog = !instId && (!dogEl || dogEl.id === "dog-character");

      if (this.focusMode === "running") {
        const quote =
          customText ||
          DOG_QUOTES_FOCUS[Math.floor(Math.random() * DOG_QUOTES_FOCUS.length)];
        this.showSmartSpeechBubble(quote, dogEl);
        return;
      }

      if (isPrimaryDog) {
        this.dog.state = "react";
        this.dog.reactTimer = 1.1;
        this.dog.stateTimer = 1.2;
      } else if (instId) {
        const extraState = this.extraAnimalStates.get(instId);
        if (extraState) {
          extraState.state = "react";
          extraState.reactTimer = 1.1;
          extraState.stateTimer = 1.25;
        }
      }

      const quote =
        customText ||
        DOG_QUOTES_IDLE[Math.floor(Math.random() * DOG_QUOTES_IDLE.length)];
      this.showSmartSpeechBubble(quote, dogEl);
    }

    triggerPropInteraction(propId, targetEl) {
      const el = targetEl || this.svg?.querySelector(`#prop-${propId}`);
      const instId = el?.getAttribute?.("data-instance-id") || null;
      const item = getItemById(propId);

      if (instId) {
        // 복제 개체 터치 시 해당 instanceId 개체에만 반응 애니메이션 적용
        const extraState = this.extraAnimalStates.get(instId);
        if (extraState && propId !== "goldfish_bowl") {
          extraState.state = "react";
          extraState.reactTimer = propId === "little_turtle" ? 1.8 : 1.2;
          extraState.stateTimer = extraState.reactTimer + 0.5;
        }
      } else {
        const a = this.animals[propId];
        if (a && propId !== "goldfish_bowl") {
          a.state = "react";
          a.reactTimer = propId === "little_turtle" ? 2.0 : 1.25;
          a.stateTimer = a.reactTimer + 0.5;
        }
      }

      switch (propId) {
        case "window_cat": {
          audioEngine.playPetReactionSound("meow");
          const quote = CAT_QUOTES[Math.floor(Math.random() * CAT_QUOTES.length)];
          this.showSmartSpeechBubble(quote, el);
          break;
        }

        case "cockatiel_bird": {
          audioEngine.playPetReactionSound("bark");
          this.showSmartSpeechBubble("짹짹! 집중 잘하고 있어? 🦜 (부스트 +4%)", el);
          break;
        }

        case "tuxedo_cat": {
          audioEngine.playPetReactionSound("meow");
          this.showSmartSpeechBubble("골골골... 말랑한 식빵 굽고 있어요 🐱 (부스트 +5%)", el);
          break;
        }

        case "welsh_corgi": {
          audioEngine.playPetReactionSound("bark");
          this.showSmartSpeechBubble("멍! 물 한 잔 마실 시간! 🐶 (부스트 +5%)", el);
          break;
        }

        case "little_turtle": {
          audioEngine.playPetReactionSound("bark");
          this.showSmartSpeechBubble("천천히 가도 괜찮아 🐢 (부스트 +3%)", el);
          break;
        }

        case "hedgehog_friend": {
          audioEngine.playPetReactionSound("bark");
          this.showSmartSpeechBubble("따끔! 딴짓 금지야 🦔 (부스트 +4%)", el);
          break;
        }

        case "white_rabbit": {
          audioEngine.playPetReactionSound("bark");
          this.showSmartSpeechBubble("깡총! 오늘도 화이팅 🐰 (부스트 +3%)", el);
          break;
        }

        case "goldfish_bowl": {
          audioEngine.playPetReactionSound("bark");
          this.animals.goldfish_bowl.bubbleTimer = 1.8;
          this.animals.goldfish_bowl.state = "play";
          this.animals.goldfish_bowl.stateTimer = 2.2;
          this.showSmartSpeechBubble("뻐끔... 집중력이 맑아져요 🐠 (부스트 +3%)", el);
          break;
        }

        case "tennis_ball": {
          this.ballBounce = 1.0;
          audioEngine.playPetReactionSound("bark");
          this.showSmartSpeechBubble(
            item?.reactionQuote || "통통! 공놀이 제일 좋아해요 🎾",
            el
          );
          break;
        }

        case "stand_lamp":
        case "cloud_wall_lamp":
        case "crescent_mood_lamp":
        case "mushroom_stand_lamp":
        case "starlight_garland":
        case "aroma_candle": {
          const curLit = appStorage ? appStorage.getLampLit(propId) : true;
          const nextLit = !curLit;
          this.applyLampLitVisual(nextLit, propId);
          if (appStorage) {
            appStorage.setLampLit(nextLit, propId);
          }
          const onMessages = {
            stand_lamp: "스탠드 조명을 따뜻하게 켰어요 💡 (부스트 +4%)",
            cloud_wall_lamp: "몽글 구름 벽조명을 포근하게 켰어요 ☁️ (부스트 +4%)",
            crescent_mood_lamp: "초승달 무드등에 은은한 달빛이 켜졌어요 🌙 (부스트 +3%)",
            mushroom_stand_lamp: "동글한 버섯 단스탠드를 따뜻하게 켰어요 🍄 (부스트 +3%)",
            starlight_garland: "별빛 가랜드 줄조명이 반짝반짝 켜졌어요 ✨ (부스트 +4%)",
            aroma_candle: "아로마 캔들에 따뜻한 촛불을 켰어요 🕯️ (부스트 +2%)"
          };
          const offMessages = {
            aroma_candle: "후— 아로마 캔들 촛불을 잠시 껐어요 🌙"
          };
          this.showSmartSpeechBubble(
            nextLit
              ? onMessages[propId] || "조명을 따뜻하게 켰어요 💡"
              : offMessages[propId] || "조명을 잠시 껐어요 🌙",
            el
          );
          break;
        }

        case "wooden_bird_perch": {
          audioEngine.playPetReactionSound("bark");
          // 거실에 왕관앵무도 함께 배치되어 있으면 클릭 시 즉시 횃대 가로 막대 윗선(perchPos.y - 53.5)으로 날아와 착지!
          if (this.placedItems.has("cockatiel_bird")) {
            const perchPos = this.getCurrentItemPosition("wooden_bird_perch");
            const bird = this.animals.cockatiel_bird;
            if (bird) {
              const clampedX = this.clampPositionForItem(
                perchPos.x - 3 + (Math.random() - 0.5) * 12,
                perchPos.y,
                "cockatiel_bird"
              ).x;
              bird.startX = bird.x;
              bird.startY = bird.y;
              bird.targetX = clampedX;
              bird.targetY = perchPos.y - 53.5;
              bird.moveDir = bird.targetX >= bird.x ? 1 : -1;
              bird.jumpProgress = 0;
              bird.jumpDuration = 0.72;
              bird.state = "fly";
            }
            this.showSmartSpeechBubble(
              "짹짹! 앵무새가 횃대 위로 날아왔어요 🦜",
              el
            );
          } else {
            this.showSmartSpeechBubble(
              item?.reactionQuote || "앵무새가 쉬어가는 원목 횃대예요 🦜",
              el
            );
          }
          break;
        }

        case "wall_wood_branch": {
          audioEngine.playPetReactionSound("bark");
          // 거실에 왕관앵무도 함께 배치되어 있으면 클릭 시 즉시 벽면 나뭇가지 윗면 선(branchPos.y - 5.5)으로 날아와 착지!
          if (this.placedItems.has("cockatiel_bird")) {
            const branchPos = this.getCurrentItemPosition("wall_wood_branch");
            const bird = this.animals.cockatiel_bird;
            if (bird) {
              const clampedX = this.clampPositionForItem(
                branchPos.x - 3 + (Math.random() - 0.5) * 14,
                branchPos.y,
                "cockatiel_bird"
              ).x;
              bird.startX = bird.x;
              bird.startY = bird.y;
              bird.targetX = clampedX;
              bird.targetY = branchPos.y - 5.5;
              bird.moveDir = bird.targetX >= bird.x ? 1 : -1;
              bird.jumpProgress = 0;
              bird.jumpDuration = 0.75;
              bird.state = "fly";
            }
            this.showSmartSpeechBubble(
              "짹짹! 나뭇가지 위로 날아와 쉬어요 🌿",
              el
            );
          } else {
            this.showSmartSpeechBubble(
              item?.reactionQuote || "앵무새가 쉬어가는 벽면 나뭇가지 🌿",
              el
            );
          }
          break;
        }

        case "mini_cat_tower": {
          audioEngine.playPetReactionSound("meow");
          // 거실에 고양이가 있으면 클릭 시 캣타워 중간 또는 꼭대기 발판으로 폴짝 점프!
          const placedCats = ["window_cat", "tuxedo_cat"].filter((cid) =>
            this.placedItems.has(cid)
          );
          if (placedCats.length > 0) {
            const catId = placedCats[Math.floor(Math.random() * placedCats.length)];
            const cat = this.animals[catId];
            const towerPos = this.getCurrentItemPosition("mini_cat_tower");
            const platforms = [
              { x: towerPos.x - 9, y: towerPos.y - 94 }, // 3단 꼭대기 둥지
              { x: towerPos.x + 14, y: towerPos.y - 62 }, // 2단 우측 발판
              { x: towerPos.x - 16, y: towerPos.y - 58 }  // 2단 좌측 발판
            ];
            const pick = platforms[Math.floor(Math.random() * platforms.length)];
            const target = this.clampPositionForItem(pick.x, pick.y, catId);
            if (cat) {
              cat.startX = cat.x;
              cat.startY = cat.y;
              cat.targetX = target.x;
              cat.targetY = target.y;
              cat.moveDir = target.x >= cat.x ? 1 : -1;
              cat.nextActionAfterJump = "cat_tower_perch";
              cat.state = "crouch_jump";
              cat.stateTimer = 0.25;
            }
            this.showSmartSpeechBubble(
              "폴짝! 캣타워 위로 올라갔어요 🐾",
              el
            );
          } else {
            this.showSmartSpeechBubble(
              item?.reactionQuote || "고양이가 좋아하는 3단 캣타워 🐾",
              el
            );
          }
          break;
        }

        case "beige_cushion": {
          audioEngine.playPetReactionSound("bark");
          const cushionPos = this.getCurrentItemPosition("beige_cushion");
          // 배치된 지상 동물 중 한 마리가 방석 위로 걸어와 낮잠을 자도록 유도
          if (this.placedItems.has("living_room_dog") && Math.random() < 0.5) {
            const target = this.clampPositionForItem(
              cushionPos.x,
              cushionPos.y - 10,
              "living_room_dog"
            );
            this.dog.targetX = target.x;
            this.dog.targetY = target.y;
            this.dog.moveDir = target.x >= this.dog.x ? 1 : -1;
            this.dog.nextActionAfterWalk = "rest_on_cushion";
            this.dog.state = "walk";
            this.showSmartSpeechBubble(
              "폭신한 방석 위에서 낮잠 잘 준비 중 🧶",
              el
            );
          } else {
            const cushionPets = [
              "welsh_corgi",
              "window_cat",
              "tuxedo_cat",
              "white_rabbit"
            ].filter((pid) => this.placedItems.has(pid));
            if (cushionPets.length > 0) {
              const pid = cushionPets[Math.floor(Math.random() * cushionPets.length)];
              const pet = this.animals[pid];
              const target = this.clampPositionForItem(
                cushionPos.x + (Math.random() - 0.5) * 14,
                cushionPos.y - 2,
                pid
              );
              if (pet) {
                pet.targetX = target.x;
                pet.targetY = target.y;
                pet.moveDir = target.x >= pet.x ? 1 : -1;
                pet.nextActionAfterWalk = "rest_on_cushion";
                pet.state = "walk";
              }
              this.showSmartSpeechBubble(
                "폭신한 방석 위로 쉬러 왔어요 🧶",
                el
              );
            } else {
              this.showSmartSpeechBubble(
                item?.reactionQuote || "낮잠을 부르는 폭신한 코튼 방석 🧶",
                el
              );
            }
          }
          break;
        }

        case "yellow_duck_toy": {
          this.duckSqueakTimer = 0.9;
          audioEngine.playPetReactionSound("bark");
          this.showSmartSpeechBubble("삑삑! 노란 오리가 통통 튀어요 🐤", el);
          break;
        }

        case "hamster_wheel": {
          this.wheelSpinTimer = 3.2;
          audioEngine.playPetReactionSound("bark");
          // 거실에 햄스터도 함께 배치되어 있으면 클릭 시 햄스터가 쳇바퀴로 쪼르르 달려와 탑승!
          if (this.placedItems.has("hamster_friend")) {
            const wheelPos = this.getCurrentItemPosition("hamster_wheel");
            const ham = this.animals.hamster_friend;
            if (ham) {
              const target = this.clampPositionForItem(
                wheelPos.x,
                wheelPos.y - 13,
                "hamster_friend"
              );
              ham.targetX = target.x;
              ham.targetY = target.y;
              ham.moveDir = target.x >= ham.x ? 1 : -1;
              ham.pauseDuringWalk = 0;
              ham.nextActionAfterWalk = "wheel_run";
              ham.state = "walk";
            }
            this.showSmartSpeechBubble(
              "쪼르르! 햄스터가 우드 쳇바퀴에 올라타 신나게 달려요 🐹 (부스트 +3%)",
              el
            );
          } else {
            this.showSmartSpeechBubble("우드 쳇바퀴가 빙글빙글 돌아가요 🐹 (부스트 +3%)", el);
          }
          break;
        }

        case "vintage_turntable": {
          this.turntablePlayTimer = 3.2;
          audioEngine.playPetReactionSound("bark");
          this.showSmartSpeechBubble("LP 턴테이블에서 잔잔한 멜로디가 흘러나와요 🎵 (부스트 +5%)", el);
          break;
        }

        case "sparkle_snow_globe": {
          this.snowGlobeShakeTimer = 2.4;
          audioEngine.playPetReactionSound("bark");
          this.showSmartSpeechBubble("스노우볼 속에서 하얀 눈송이가 반짝이며 흩날려요 ❄️ (부스트 +3%)", el);
          break;
        }

        default: {
          audioEngine.playPetReactionSound("bark");
          this.showSmartSpeechBubble(
            item?.reactionQuote ||
              `${item?.name || "소품"} (✨ 부스트 +${item?.boostPercent || 2}%)`,
            el
          );
          break;
        }
      }
    }

    showSmartSpeechBubble(text, targetSvgEl) {
      if (!this.bubbleEl || !this.svg) return;

      const stageEl = this.svg.parentElement;
      if (!stageEl) return;

      // 말풍선에서 배치 리워드(부스트 +N%) 표기를 완전히 제거하고 순수 대사만 1줄 최적화 표시
      const rawText = String(text || "").trim();
      const withoutBoost = rawText
        .replace(/\s*\((?:집중\s*)?부스트\s*\+\d+%\)\s*$/g, "")
        .trim();
      // 문장 끝 이모지만 혼자 다음 줄로 떨어지지 않도록 비분리 공백(\u00A0)으로 연결
      const cleanQuote = withoutBoost.replace(
        /\s+([^\s\w가-힣ㄱ-ㅎㅏ-ㅣ.,!?~·()]+)$/u,
        "\u00A0$1"
      );

      this.bubbleEl.innerHTML = "";
      const textSpan = document.createElement("span");
      textSpan.className = "speech-bubble-text";
      textSpan.textContent = cleanQuote;
      this.bubbleEl.appendChild(textSpan);

      this.activeBubbleInstanceId = targetSvgEl?.getAttribute("data-instance-id") || targetSvgEl?.id || null;
      this.bubbleEl.classList.remove("flip-bottom");
      this.bubbleEl.classList.add("visible");

      const stageRect = stageEl.getBoundingClientRect();
      const targetRect = targetSvgEl
        ? targetSvgEl.getBoundingClientRect()
        : stageRect;

      const bubbleW = this.bubbleEl.offsetWidth || 160;
      const bubbleH = this.bubbleEl.offsetHeight || 36;

      const objCenterX =
        targetRect.left - stageRect.left + targetRect.width / 2;
      const objTop = targetRect.top - stageRect.top;
      const objBottom = targetRect.bottom - stageRect.top;

      const verticalGap = 10;

      let topPx = objTop - bubbleH - verticalGap;
      if (topPx < 10) {
        topPx = Math.min(
          stageRect.height - bubbleH - 12,
          objBottom + VerticalGapFallback(verticalGap)
        );
        this.bubbleEl.classList.add("flip-bottom");
      } else {
        this.bubbleEl.classList.remove("flip-bottom");
      }

      const edgePad = 12;
      const minLeft = edgePad;
      const maxLeft = Math.max(edgePad, stageRect.width - bubbleW - edgePad);
      const idealLeft = objCenterX - bubbleW / 2;
      const clampedLeft = Math.max(minLeft, Math.min(maxLeft, idealLeft));

      const tailX = Math.max(16, Math.min(bubbleW - 16, objCenterX - clampedLeft));

      this.bubbleEl.style.left = `${Math.round(clampedLeft)}px`;
      this.bubbleEl.style.top = `${Math.round(topPx)}px`;
      this.bubbleEl.style.setProperty("--tail-left", `${Math.round(tailX)}px`);

      if (this.bubbleTimeout) clearTimeout(this.bubbleTimeout);
      this.bubbleTimeout = setTimeout(() => {
        this.hideSpeechBubble();
      }, 2500);
    }

    hideSpeechBubble() {
      this.bubbleEl?.classList.remove("visible");
    }

    startLoop() {
      const step = (now) => {
        const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
        this.lastFrameTime = now;
        this.update(dt, now / 1000);
        this.rafId = requestAnimationFrame(step);
      };
      this.rafId = requestAnimationFrame(step);
    }

    /**
     * 지상 보행 동물(강아지, 웰시코기, 햄스터, 거북이, 고슴도치)의 다음 보행 목적지 계산
     * - 절대 공중으로 날지 않고:
     *   1) 창틀 선(y=54, 122, 190) 위에 있으면 해당 창틀 선을 따라서만 좌우로 걸어 이동
     *   2) 바닥에 있으면 바닥 영역(y: 220 ~ maxY) 내에서만 자연스럽게 걸어 이동
     */
    pickGroundWalkTarget(curX, curY, itemId) {
      const bounds = this.getStageSvgBounds();
      const btn = this.getFocusButtonSvgMetrics();
      const bottomOffset = ITEM_BOTTOM_OFFSET[itemId] || 0;
      const allowWindowBar = CLIMBER_PETS.has(itemId) || itemId === "cockatiel_bird";
      const curBar = allowWindowBar ? this.getCurrentWindowBar(curX, curY, itemId) : null;

      if (curBar) {
        // 현재 있는 4각 창틀 가로 선 위를 따라 좌우로만 보행 (바닥면이 창틀 선에 정확히 맞닿음)
        const span = Math.max(20, curBar.walkMaxX - curBar.walkMinX);
        const nextX = curBar.walkMinX + Math.random() * span;
        return this.clampPositionForItem(nextX, curBar.y - bottomOffset, itemId);
      }

      // 창틀 선 아래 바닥 영역 내에서만 보행
      const minFloorY = FLOOR_MIN_Y - bottomOffset;
      const maxFloorY = Math.max(minFloorY + 30, btn.topY - 22 - bottomOffset);
      const nextX =
        bounds.minX + 34 + Math.random() * Math.max(40, bounds.maxX - bounds.minX - 68);
      const deltaY = (Math.random() - 0.5) * 75;
      const baseFloorY = curY < minFloorY ? Math.max(minFloorY + 40, 260) : curY;
      const nextY = Math.max(minFloorY, Math.min(maxFloorY, baseFloorY + deltaY));
      return this.clampPositionForItem(nextX, nextY, itemId);
    }

    /**
     * 강아지의 5단계 행동 상태(walk, idle, play, rest, react + 베이지 방석 낮잠 연동) 전환
     */
    pickNextDogState(targetDog = this.dog) {
      const d = targetDog || this.dog;
      const roll = Math.random();
      const hasCushion = this.placedItems.has("beige_cushion");

      // 거실에 폭신폭신 베이지 방석이 있으면 일정 확률(약 28%)로 방석 위로 걸어가 중앙에 올라타 낮잠(rest)을 잠
      if (hasCushion && roll < 0.28) {
        const cushionPos = this.getCurrentItemPosition("beige_cushion");
        const target = this.clampPositionForItem(
          cushionPos.x + (Math.random() - 0.5) * 14,
          cushionPos.y - 10,
          "living_room_dog"
        );
        const dist = Math.hypot(target.x - d.x, target.y - d.baseY);
        if (dist <= 6) {
          d.state = "rest";
          d.stateTimer = 5.5 + Math.random() * 3.5;
        } else {
          d.targetX = target.x;
          d.targetY = target.y;
          d.moveDir = d.targetX >= d.x ? 1 : -1;
          d.nextActionAfterWalk = "rest_on_cushion";
          d.state = "walk";
        }
        return;
      }

      if (roll < 0.52) {
        // 1. walk: 현재 표면(창틀 선 또는 바닥)을 따라 실제로 발을 움직여 걷기
        const target = this.pickGroundWalkTarget(d.x, d.baseY, "living_room_dog");
        d.targetX = target.x;
        d.targetY = target.y;
        if (Math.abs(d.targetX - d.x) > 1) {
          d.moveDir = d.targetX >= d.x ? 1 : -1;
        }
        d.nextActionAfterWalk = null;
        d.state = "walk";
      } else if (roll < 0.72) {
        // 2. idle: 숨쉬기 + 눈 깜빡임 + 꼬리 살랑이기
        d.state = "idle";
        d.stateTimer = 3.2 + Math.random() * 3.5;
      } else if (roll < 0.88) {
        // 3. play: 배 깔고 앞발 꼼지락 장난치기 또는 기지개 켜기
        d.state = "play";
        d.playSubMode = Math.random() < 0.5 ? "patter" : "bow";
        d.stateTimer = 3.0 + Math.random() * 2.5;
      } else {
        // 4. rest: 자리에 동그랗게 웅크려 눈 감고 쉬기
        d.state = "rest";
        d.stateTimer = 4.5 + Math.random() * 3.5;
      }
    }

    /**
     * 동물 9종(고양이 2종, 햄스터, 왕관앵무, 웰시코기, 거북이, 고슴도치, 토끼, 금붕어)의 다음 상태 결정
     * - 왕관앵무: 원목 새 횃대(wooden_bird_perch) & 포근한 벽면 나뭇가지(wall_wood_branch) 착지 연동
     * - 고양이 2종: 미니 원목 캣타워(mini_cat_tower) 2·3단 발판 점프 & 베이지 방석(beige_cushion) 낮잠 연동
     * - 햄스터: 우드 햄스터 쳇바퀴(hamster_wheel) 탑승 3~6초 달리기 연동
     * - 웰시코기·토끼·고슴도치·거북이: 베이지 방석(beige_cushion) 위 낮잠·휴식 연동
     */
    pickNextAnimalState(itemId, a) {
      const bounds = this.getStageSvgBounds();
      const btn = this.getFocusButtonSvgMetrics();
      const roll = Math.random();
      const hasCushion = this.placedItems.has("beige_cushion");
      const cushionPos = hasCushion ? this.getCurrentItemPosition("beige_cushion") : null;

      // -----------------------------------------------------------------------
      // [A] 왕관앵무 (cockatiel_bird):
      //     이동할 때만 허공 비행(fly), 멈춰서 쉬거나 잘 때는 반드시
      //     4각 창틀(특히 맨 윗틀 y=54), 포근한 벽면 나뭇가지, 원목 새 횃대 중 하나에 착지
      // -----------------------------------------------------------------------
      if (itemId === "cockatiel_bird") {
        const birdFootOffset = ITEM_BOTTOM_OFFSET.cockatiel_bird || 1.5;
        const curBar = this.getCurrentWindowBar(a.x, a.y, itemId);

        const hasPerch = this.placedItems.has("wooden_bird_perch");
        const perchPos = hasPerch ? this.getCurrentItemPosition("wooden_bird_perch") : null;
        // 왕관앵무 발끝(y=+1.5)이 원목 새 횃대 가로 막대 윗선(y=-52)에 정확히 맞닿도록 y - 53.5 보정
        const perchBarY = perchPos ? perchPos.y - 53.5 : null;
        const onPerch =
          hasPerch &&
          perchPos &&
          Math.abs(a.y - perchBarY) <= 8 &&
          Math.abs(a.x - (perchPos.x - 3)) <= 20;

        const hasBranch = this.placedItems.has("wall_wood_branch");
        const branchPos = hasBranch ? this.getCurrentItemPosition("wall_wood_branch") : null;
        // 왕관앵무 발끝(y=+1.5)이 벽면 나뭇가지 윗면 선(y=-4)에 정확히 맞닿도록 y - 5.5 보정
        const branchBarY = branchPos ? branchPos.y - 5.5 : null;
        const onBranch =
          hasBranch &&
          branchPos &&
          Math.abs(a.y - branchBarY) <= 8 &&
          Math.abs(a.x - (branchPos.x - 3)) <= 22;

        // 이미 원목 새 횃대 또는 벽면 나뭇가지 위에 앉아 있을 때: 위에서 종종걸음하거나 고개를 갸웃거리며 쉬어감
        if ((onPerch || onBranch) && roll < 0.60) {
          const baseCenterX = onPerch ? perchPos.x - 3 : branchPos.x - 3;
          const baseBarY = onPerch ? perchBarY : branchBarY;
          if (Math.random() < 0.42) {
            a.state = "walk";
            const clampedX = this.clampPositionForItem(
              baseCenterX + (Math.random() - 0.5) * 16,
              baseBarY,
              itemId
            ).x;
            a.targetX = clampedX;
            a.targetY = baseBarY;
            a.moveDir = a.targetX >= a.x ? 1 : -1;
          } else if (Math.random() < 0.72) {
            a.state = "play"; // 고개 갸웃거리기 & 깃털 고르기
            a.playType = Math.random() < 0.65 ? 1 : 0;
            a.stateTimer = 3.2 + Math.random() * 2.5;
          } else {
            a.state = "rest";
            a.stateTimer = 4.2 + Math.random() * 2.8;
          }
          return;
        }

        if (roll < 0.26 && curBar) {
          // 현재 앉아있는 4각 창틀 가로선 위에서 종종걸음으로 걷기 (발끝이 창틀 선에 정확히 맞닿음)
          a.state = "walk";
          a.targetX = curBar.walkMinX + Math.random() * (curBar.walkMaxX - curBar.walkMinX);
          a.targetY = curBar.y - birdFootOffset;
          a.moveDir = a.targetX >= a.x ? 1 : -1;
          return;
        }
        if (roll < 0.66) {
          // 날개를 퍼덕이며 부드럽게 비행 이동 -> 반드시 지지대(벽면 나뭇가지, 원목 새 횃대, 4각 창틀 윗틀/창살/아래창틀)에 착지!
          const specialPerches = [];
          if (hasBranch && branchPos && !onBranch) {
            specialPerches.push({
              x: branchPos.x - 3 + (Math.random() - 0.5) * 14,
              y: branchBarY,
              isPerchSurface: true
            });
          }
          if (hasPerch && perchPos && !onPerch) {
            specialPerches.push({
              x: perchPos.x - 3 + (Math.random() - 0.5) * 12,
              y: perchBarY,
              isPerchSurface: true
            });
          }

          let rawPick = null;
          if (specialPerches.length > 0 && Math.random() < 0.65) {
            rawPick = specialPerches[Math.floor(Math.random() * specialPerches.length)];
          } else {
            // 4각 창문 맨 윗틀(y=24) 비중을 높이고, 중간 창살(y=92)·아래 창틀(y=160)까지 발끝 정확히 맞춤 (허공/버튼 좌표 제거)
            const flySpots = [
              { x: 152, y: WINDOW_TOP_Y - birdFootOffset },
              { x: 190, y: WINDOW_TOP_Y - birdFootOffset },
              { x: 228, y: WINDOW_TOP_Y - birdFootOffset },
              { x: 156, y: WINDOW_MID_Y - birdFootOffset },
              { x: 224, y: WINDOW_MID_Y - birdFootOffset },
              { x: 82, y: WINDOW_SILL_Y - birdFootOffset },
              { x: 296, y: WINDOW_SILL_Y - birdFootOffset }
            ];
            specialPerches.forEach((sp) => flySpots.push(sp));
            rawPick = flySpots[Math.floor(Math.random() * flySpots.length)];
          }

          const clamped = this.clampPositionForItem(rawPick.x, rawPick.y, itemId);
          const finalY = rawPick.isPerchSurface ? rawPick.y : clamped.y;
          a.startX = a.x;
          a.startY = a.y;
          a.targetX = clamped.x;
          a.targetY = finalY;
          a.moveDir = clamped.x >= a.x ? 1 : -1;
          a.jumpProgress = 0;
          a.jumpDuration = 0.95 + Math.random() * 0.35;
          a.state = "fly";
          return;
        }
        if (roll < 0.85) {
          a.state = "play"; // 날개 깃털 다듬기 또는 고개 갸웃거리기
          a.playType = Math.random() < 0.5 ? 0 : 1;
          a.stateTimer = 3.0 + Math.random() * 2.5;
          return;
        }
        if (roll < 0.93) {
          a.state = "idle";
          a.stateTimer = 3.0 + Math.random() * 3.0;
          return;
        }
        a.state = "rest";
        a.stateTimer = 4.0 + Math.random() * 3.0;
        return;
      }

      // -----------------------------------------------------------------------
      // [B] 고양이 2종(window_cat, tuxedo_cat):
      //     바닥 영역 + 4각 창틀(① 맨 윗틀 y=54 · ② 가운데 창살 y=122 · ③ 아래 창틀 y=190) + 캣타워 + 방석
      // -----------------------------------------------------------------------
      if (itemId === "window_cat" || itemId === "tuxedo_cat") {
        const catBottomOffset = ITEM_BOTTOM_OFFSET[itemId] || 0;
        const hasCatTower = this.placedItems.has("mini_cat_tower");
        const towerPos = hasCatTower ? this.getCurrentItemPosition("mini_cat_tower") : null;

        // 현재 고양이가 캣타워 발판 위에 올라가 있는지 판별
        const onCatTower =
          hasCatTower &&
          towerPos &&
          Math.abs(a.x - towerPos.x) <= 32 &&
          (Math.abs(a.y - (towerPos.y - 94)) <= 8 ||
            Math.abs(a.y - (towerPos.y - 62)) <= 8 ||
            Math.abs(a.y - (towerPos.y - 58)) <= 8);

        // 이미 캣타워 발판 위에 올라가 있을 때는 그 위에서 식빵을 굽거나(rest) 그루밍(play)하며 더 오래 머무름
        if (onCatTower && roll < 0.62) {
          if (Math.random() < 0.55) {
            a.state = "rest"; // 식빵 굽기 & 낮잠
            a.stateTimer = 5.0 + Math.random() * 3.5;
          } else {
            a.state = "play"; // 앞발 세수(그루밍) 또는 기지개
            a.playType = Math.random() < 0.7 ? 0 : 1;
            a.stateTimer = 3.5 + Math.random() * 2.5;
          }
          return;
        }

        // 1) 고양이 전용: 캣타워가 거실에 있으면 높은 확률로 캣타워 중간·꼭대기 발판으로 폴짝 점프!
        if (hasCatTower && towerPos && !onCatTower && roll < 0.34) {
          const towerPlatforms = [
            { x: towerPos.x - 9, y: towerPos.y - 94 }, // 3단 꼭대기 둥지 베드
            { x: towerPos.x + 14, y: towerPos.y - 62 }, // 2단 우측 메인 발판
            { x: towerPos.x - 16, y: towerPos.y - 58 }  // 2단 좌측 중간 발판
          ];
          const rawPick = towerPlatforms[Math.floor(Math.random() * towerPlatforms.length)];
          const clamped = this.clampPositionForItem(rawPick.x, rawPick.y, itemId);
          a.startX = a.x;
          a.startY = a.y;
          a.targetX = clamped.x;
          a.targetY = clamped.y;
          a.moveDir = clamped.x >= a.x ? 1 : -1;
          a.nextActionAfterJump = "cat_tower_perch";
          a.state = "crouch_jump";
          a.stateTimer = 0.30;
          return;
        }

        // 2) 베이지 방석(beige_cushion)이 있으면 일정 확률로 방석 위로 이동해 낮잠(rest)
        if (hasCushion && cushionPos && cushionPos.y >= 168 && roll < 0.52 && roll >= 0.32) {
          const target = this.clampPositionForItem(
            cushionPos.x + (Math.random() - 0.5) * 18,
            cushionPos.y - 2,
            itemId
          );
          const curBar = this.getCurrentWindowBar(a.x, a.y, itemId);
          if (curBar || onCatTower || Math.abs(target.y - a.y) > 45) {
            a.startX = a.x;
            a.startY = a.y;
            a.targetX = target.x;
            a.targetY = target.y;
            a.moveDir = target.x >= a.x ? 1 : -1;
            a.nextActionAfterJump = "rest_on_cushion";
            a.state = "crouch_jump";
            a.stateTimer = 0.30;
          } else {
            a.targetX = target.x;
            a.targetY = target.y;
            a.moveDir = target.x >= a.x ? 1 : -1;
            a.nextActionAfterWalk = "rest_on_cushion";
            a.state = "walk";
          }
          return;
        }

        if (roll < 0.42) {
          // 지상/창틀 보행
          const target = this.pickGroundWalkTarget(a.x, a.y, itemId);
          a.targetX = target.x;
          a.targetY = target.y;
          if (Math.abs(target.x - a.x) > 1) a.moveDir = target.x >= a.x ? 1 : -1;
          a.nextActionAfterWalk = null;
          a.state = "walk";
          return;
        }
        if (roll < 0.58) {
          // 4각 창틀(윗틀·중간 창살·아래 창틀) 및 바닥 오르내리기 점프 (빈 벽 허공·하단 버튼 제외)
          const curBar = this.getCurrentWindowBar(a.x, a.y, itemId);
          let candidates = [];
          if (curBar) {
            if (curBar.y === WINDOW_TOP_Y) {
              candidates = [
                { x: 156, y: WINDOW_MID_Y - catBottomOffset },
                { x: 224, y: WINDOW_MID_Y - catBottomOffset }
              ];
            } else if (curBar.y === WINDOW_MID_Y) {
              candidates = [
                { x: 190, y: WINDOW_TOP_Y - catBottomOffset },
                { x: 156, y: WINDOW_SILL_Y - catBottomOffset },
                { x: 224, y: WINDOW_SILL_Y - catBottomOffset }
              ];
            } else {
              // y === WINDOW_SILL_Y (하단 창틀 선반) -> 중간 창틀 또는 바로 아래 확장된 바닥(224)으로 가볍게 착지
              candidates = [
                { x: 156, y: WINDOW_MID_Y - catBottomOffset },
                { x: 224, y: WINDOW_MID_Y - catBottomOffset },
                { x: Math.max(70, Math.min(310, a.x + (Math.random() - 0.5) * 60)), y: 224 }
              ];
            }
          } else {
            // 바닥이나 캣타워에 있을 때 -> 아래 창틀 선반 또는 바닥 영역으로 점프
            candidates = [
              { x: 84, y: WINDOW_SILL_Y - catBottomOffset },
              { x: 156, y: WINDOW_SILL_Y - catBottomOffset },
              { x: 294, y: WINDOW_SILL_Y - catBottomOffset },
              { x: 190, y: 245 }
            ];
          }
          if (hasCatTower && towerPos) {
            candidates.push({ x: towerPos.x - 9, y: towerPos.y - 94 });
            candidates.push({ x: towerPos.x + 14, y: towerPos.y - 62 });
          }
          const rawPick = candidates[Math.floor(Math.random() * candidates.length)];
          const clamped = this.clampPositionForItem(rawPick.x, rawPick.y, itemId);
          a.startX = a.x;
          a.startY = a.y;
          a.targetX = clamped.x;
          a.targetY = clamped.y;
          a.moveDir = clamped.x >= a.x ? 1 : -1;
          a.nextActionAfterJump = null;
          a.state = "crouch_jump";
          a.stateTimer = 0.30;
          return;
        }
        if (roll < 0.75) {
          a.state = "play"; // 그루밍 / 기지개
          a.playType = Math.random() < 0.5 ? 0 : 1;
          a.stateTimer = 3.0 + Math.random() * 2.5;
          return;
        }
        if (roll < 0.87) {
          a.state = "idle";
          a.stateTimer = 3.0 + Math.random() * 3.0;
          return;
        }
        a.state = "rest";
        a.stateTimer = 4.5 + Math.random() * 3.5;
        return;
      }

      // -----------------------------------------------------------------------
      // [C] 햄스터 (hamster_friend):
      //     바닥 영역 + 4각 창틀(윗틀·중간 창살·아래 창틀) + 우드 햄스터 쳇바퀴 + 베이지 방석
      // -----------------------------------------------------------------------
      if (itemId === "hamster_friend") {
        const hamOffset = ITEM_BOTTOM_OFFSET.hamster_friend || 1;
        if (this.placedItems.has("hamster_wheel") && roll < 0.44) {
          const wheelPos = this.getCurrentItemPosition("hamster_wheel");
          const rideTarget = this.clampPositionForItem(
            wheelPos.x,
            wheelPos.y - 13,
            "hamster_friend"
          );
          const distToWheel = Math.hypot(rideTarget.x - a.x, rideTarget.y - a.y);
          if (distToWheel <= 5) {
            a.x = rideTarget.x;
            a.y = rideTarget.y;
            a.state = "wheel_run";
            a.stateTimer = 3.4 + Math.random() * 2.6;
            this.wheelSpinTimer = Math.max(this.wheelSpinTimer, a.stateTimer);
          } else if (Math.abs(rideTarget.y - a.y) > 36) {
            // 창틀과 바닥 사이처럼 높이 차가 크면 폴짝 점프로 이동
            a.startX = a.x;
            a.startY = a.y;
            a.targetX = rideTarget.x;
            a.targetY = rideTarget.y;
            a.moveDir = rideTarget.x >= a.x ? 1 : -1;
            a.nextActionAfterJump = "wheel_run";
            a.jumpProgress = 0;
            a.jumpDuration = 0.42;
            a.state = "jump_arc";
          } else {
            a.targetX = rideTarget.x;
            a.targetY = rideTarget.y;
            a.moveDir = rideTarget.x >= a.x ? 1 : -1;
            a.pauseDuringWalk = 0;
            a.nextActionAfterWalk = "wheel_run";
            a.state = "walk";
          }
          return;
        }

        // 4각 창틀(윗틀·중간 창살·아래 창틀) ↔ 바닥 오르내리기
        if (roll >= 0.44 && roll < 0.56) {
          const curBar = this.getCurrentWindowBar(a.x, a.y, itemId);
          let candidates = [];
          if (curBar) {
            if (curBar.y === WINDOW_TOP_Y) {
              candidates = [
                { x: 156, y: WINDOW_MID_Y - hamOffset },
                { x: 224, y: WINDOW_MID_Y - hamOffset }
              ];
            } else if (curBar.y === WINDOW_MID_Y) {
              candidates = [
                { x: 190, y: WINDOW_TOP_Y - hamOffset },
                { x: 156, y: WINDOW_SILL_Y - hamOffset },
                { x: 224, y: WINDOW_SILL_Y - hamOffset }
              ];
            } else {
              candidates = [
                { x: 156, y: WINDOW_MID_Y - hamOffset },
                { x: 224, y: WINDOW_MID_Y - hamOffset },
                { x: Math.max(70, Math.min(310, a.x + (Math.random() - 0.5) * 60)), y: 220 }
              ];
            }
          } else {
            candidates = [
              { x: 105, y: WINDOW_SILL_Y - hamOffset },
              { x: 156, y: WINDOW_SILL_Y - hamOffset },
              { x: 224, y: WINDOW_SILL_Y - hamOffset }
            ];
          }
          const rawPick = candidates[Math.floor(Math.random() * candidates.length)];
          const clamped = this.clampPositionForItem(rawPick.x, rawPick.y, itemId);
          a.startX = a.x;
          a.startY = a.y;
          a.targetX = clamped.x;
          a.targetY = clamped.y;
          a.moveDir = clamped.x >= a.x ? 1 : -1;
          a.nextActionAfterJump = null;
          a.jumpProgress = 0;
          a.jumpDuration = 0.42;
          a.state = "jump_arc";
          return;
        }
      }

      // -----------------------------------------------------------------------
      // [D] 지상 전용 보행 동물 (웰시코기, 햄스터, 거북이, 고슴도치):
      // 베이지 방석(beige_cushion)이 배치되어 있으면 일정 확률로 방석 위까지 걸어가 낮잠(rest)
      // -----------------------------------------------------------------------
      if (hasCushion && cushionPos && roll < 0.25) {
        const curBar = this.getCurrentWindowBar(a.x, a.y, itemId);
        // 바닥에 있는 지상 동물이 방석 위로 걸어가 웅크려 쉬기
        if (!curBar) {
          const target = this.clampPositionForItem(
            cushionPos.x + (Math.random() - 0.5) * 18,
            cushionPos.y - 2,
            itemId
          );
          a.targetX = target.x;
          a.targetY = target.y;
          if (Math.abs(target.x - a.x) > 1) a.moveDir = target.x >= a.x ? 1 : -1;
          a.nextActionAfterWalk = "rest_on_cushion";
          a.state = "walk";
          return;
        }
      }

      if (roll < 0.48) {
        const target = this.pickGroundWalkTarget(a.x, a.y, itemId);
        a.targetX = target.x;
        a.targetY = target.y;
        if (Math.abs(target.x - a.x) > 1) a.moveDir = target.x >= a.x ? 1 : -1;
        a.nextActionAfterWalk = null;
        a.state = "walk";
        if (itemId === "hamster_friend" && Math.random() < 0.65) {
          // 햄스터: 쪼르르 달려가다 중간에 멈칫하기 예약
          a.pauseDuringWalk = 0.38;
        }
      } else if (roll < 0.70) {
        a.state = "play";
        a.playType = Math.random() < 0.5 ? 0 : 1;
        a.stateTimer = 3.2 + Math.random() * 2.5;
      } else if (roll < 0.86) {
        a.state = "idle";
        a.stateTimer = 3.0 + Math.random() * 3.0;
      } else {
        a.state = "rest";
        a.stateTimer = 4.2 + Math.random() * 3.5;
      }
    }

    /**
     * 어항 속 금붕어(goldfish_bowl) 단일 인스턴스(1번·2번·3번 공통) 8자 유영·꼬리·물방울 업데이트
     */
    updateGoldfishInstance(rootEl, gf, dt, elapsedSec) {
      if (!rootEl || !gf) return;
      const swimmer = rootEl.querySelector('[data-part="goldfish-swimmer"]');
      const fishTail = rootEl.querySelector('[data-part="goldfish-tail"]');
      const bubbles = rootEl.querySelector('[data-part="goldfish-bubbles"]');
      const phaseOffset = gf.animSeed || 0;

      gf.stateTimer -= dt;
      if (gf.stateTimer <= 0) {
        const r = Math.random();
        if (r < 0.55) {
          gf.state = "walk"; // 8자 곡선 유영
          gf.stateTimer = 4.5 + Math.random() * 3.5;
        } else if (r < 0.82) {
          gf.state = "play"; // 수면 가까이 올라와 뻐끔거리며 작은 물방울 생성
          gf.bubbleTimer = 1.8;
          gf.stateTimer = 2.6;
        } else {
          gf.state = "rest"; // 어항 바닥 근처에서 잔잔히 휴식
          gf.stateTimer = 3.5 + Math.random() * 2.5;
        }
      }

      const speedMult = gf.state === "rest" ? 0.65 : 1.75;
      gf.swimPhase += dt * speedMult;

      let swimX = Math.sin(gf.swimPhase) * 6.0;
      let swimY = -11 + Math.sin(gf.swimPhase * 2) * 2.4; // 부드러운 8자(Lissajous) 궤적
      let tiltDeg = 0;

      if (gf.state === "play") {
        swimY = -15.5 + Math.sin(elapsedSec * 7 + phaseOffset) * 0.9;
        tiltDeg = -14;
      } else if (gf.state === "rest") {
        swimY = -7.8 + Math.sin(elapsedSec * 2 + phaseOffset) * 0.5;
      }

      const fishDir = Math.cos(gf.swimPhase) >= 0 ? 1 : -1;
      if (swimmer) {
        swimmer.setAttribute(
          "transform",
          `translate(${swimX.toFixed(1)}, ${swimY.toFixed(1)}) scale(${fishDir}, 1) rotate(${tiltDeg})`
        );
      }
      if (fishTail) {
        const wagFreq = gf.state === "rest" ? 6 : 14;
        const tailWag = Math.sin(elapsedSec * wagFreq + phaseOffset) * 1.7;
        fishTail.setAttribute(
          "d",
          `M-6.5 0 L-11.5 ${(-3.8 + tailWag).toFixed(1)} L-10.5 ${(3.8 + tailWag).toFixed(1)} Z`
        );
      }

      if (gf.bubbleTimer > 0) {
        gf.bubbleTimer = Math.max(0, gf.bubbleTimer - dt);
        const p = 1 - gf.bubbleTimer / 1.8;
        const riseY = -p * 11;
        const alpha = Math.sin(p * Math.PI);
        if (bubbles) {
          bubbles.setAttribute("opacity", alpha.toFixed(2));
          bubbles.setAttribute("transform", `translate(0, ${riseY.toFixed(1)})`);
        }
      } else if (bubbles) {
        bubbles.setAttribute("opacity", "0");
      }
    }

    /**
     * 중복 배치된 복제 동물(#2/#3 전 종) 고유 instanceId 기반 통합 세부 행동·애니메이션 루프
     * - 1번 원본과 동일한 상태 머신(걷기·눕기·자기·꼬리·날개·헤엄·반응)을 각 개체 DOM 스코프에서 독립 실행
     */
    updateExtraPets(dt, elapsedSec) {
      if (!this.extraAnimalStates || this.extraAnimalStates.size === 0) return;

      this.extraAnimalStates.forEach((a, instanceId) => {
        const el = a.el;
        if (!el || !el.isConnected) return;

        const isThisDragging =
          Boolean(this.dragState) &&
          this.dragState.isExtraInstance &&
          this.dragState.isDragging &&
          this.dragState.instanceId === instanceId;

        if (a.itemId === "goldfish_bowl") {
          this.updateGoldfishInstance(el, a, dt, elapsedSec);
        } else if (a.itemId === "living_room_dog") {
          this.updateDogInstance(el, a, dt, elapsedSec, isThisDragging);
        } else {
          this.updateSingleCompanionPet(a.itemId, el, a, dt, elapsedSec, isThisDragging);
        }
      });
    }

    /**
     * 동물 9종(1번 원본)의 프레임별 상태 머신 및 디테일 애니메이션 업데이트
     */
    updateCompanionPets(dt, elapsedSec) {
      const isDraggingId =
        this.dragState && this.dragState.isDragging && !this.dragState.isExtraInstance
          ? this.dragState.itemId
          : null;

      // 1. 어항 속 금붕어 (1번 원본)
      if (this.placedItems.has("goldfish_bowl")) {
        const bowlEl = this.svg.querySelector("#prop-goldfish_bowl");
        this.updateGoldfishInstance(bowlEl, this.animals.goldfish_bowl, dt, elapsedSec);
      }

      // 2. 이동형 동물 8종 (1번 원본)
      const movingPetIds = [
        "window_cat",
        "tuxedo_cat",
        "hamster_friend",
        "cockatiel_bird",
        "welsh_corgi",
        "little_turtle",
        "hedgehog_friend",
        "white_rabbit"
      ];

      movingPetIds.forEach((id) => {
        if (!this.placedItems.has(id)) return;
        const el = this.svg.querySelector(`#prop-${id}`);
        if (!el) return;
        this.updateSingleCompanionPet(id, el, this.animals[id], dt, elapsedSec, isDraggingId === id);
      });
    }

    /**
     * 이동형 동물 8종 단일 인스턴스(1번·2번·3번 공통) 위치 업데이트 + 종별 세부 파츠 모션
     */
    updateSingleCompanionPet(id, el, a, dt, elapsedSec, isDragging) {
      if (!el || !a) return;
      if (isDragging) return;

        if (a.userHoldTimer > 0) {
          a.userHoldTimer = Math.max(0, a.userHoldTimer - dt);
        }

        if (a.reactTimer > 0) {
          a.reactTimer = Math.max(0, a.reactTimer - dt);
          if (a.reactTimer <= 0 && a.state === "react") {
            a.state = "idle";
            a.stateTimer = 2.0;
          }
        }

        // 드래그 해제 직후의 부드러운 안착(jump_arc / fly)은 userHoldTimer 중에도 즉시 진행
        const isLandingMotion = a.state === "jump_arc" || a.state === "fly";

        // 집중 진행 중(running)에는 유효 지지대 위에서 차분히 rest 유지 (허공에 떠 있다면 즉시 안착)
        if (this.focusMode === "running" && a.state !== "react") {
          if (!isLandingMotion && !this.isOnValidRestingSurface(a.x, a.y, id)) {
            const landPos = this.resolveValidLandingPosition(a.x, a.y, id);
            a.startX = a.x;
            a.startY = a.y;
            a.targetX = landPos.x;
            a.targetY = landPos.y;
            a.jumpProgress = 0;
            a.jumpDuration = id === "cockatiel_bird" ? 0.42 : 0.32;
            a.state = id === "cockatiel_bird" ? "fly" : "jump_arc";
          } else if (!isLandingMotion) {
            a.state = "rest";
          }
        }

        if ((a.userHoldTimer <= 0 || isLandingMotion) && a.state !== "react") {
          // 상태별 이동 및 타이머 진행
          if (a.state === "walk") {
            const dx = a.targetX - a.x;
            const dy = a.targetY - a.y;
            const dist = Math.hypot(dx, dy);

            // 햄스터가 중간에 잠깐 멈칫하는 연출 (단, 쳇바퀴 타러 가는 중일 때는 멈칫하지 않고 바로 탑승)
            if (
              id === "hamster_friend" &&
              a.nextActionAfterWalk !== "wheel_run" &&
              a.pauseDuringWalk > 0 &&
              dist < 35 &&
              dist > 15
            ) {
              a.pauseDuringWalk = Math.max(0, a.pauseDuringWalk - dt);
            } else if (dist > 2.2) {
              if (Math.abs(dx) > 0.6) {
                a.moveDir = dx >= 0 ? 1 : -1;
              }
              a.x += (dx / dist) * a.speed * dt;
              a.y += (dy / dist) * a.speed * dt;
              a.walkPhase += dt * (a.speed * 0.35);
            } else {
              a.x = a.targetX;
              a.y = a.targetY;
              if (a.nextActionAfterWalk === "wheel_run" && this.placedItems.has("hamster_wheel")) {
                a.nextActionAfterWalk = null;
                a.state = "wheel_run";
                a.stateTimer = 3.4 + Math.random() * 2.6; // 3.4~6초 동안 쳇바퀴 안에서 신나게 달리기
                this.wheelSpinTimer = Math.max(this.wheelSpinTimer, a.stateTimer);
              } else if (a.nextActionAfterWalk === "rest_on_cushion") {
                a.nextActionAfterWalk = null;
                a.state = "rest";
                a.stateTimer = 5.0 + Math.random() * 3.5; // 방석 위에서 편안하게 낮잠
              } else {
                a.nextActionAfterWalk = null;
                a.state = "idle";
                a.stateTimer = 2.6 + Math.random() * 3.0;
              }
            }
          } else if (a.state === "wheel_run") {
            // 햄스터가 쳇바퀴 안쪽에 올라타서 신나게 달리는 상태 (쳇바퀴를 드래그해 옮기면 위치 동기화)
            if (this.placedItems.has("hamster_wheel")) {
              const wheelPos = this.getCurrentItemPosition("hamster_wheel");
              a.x = wheelPos.x;
              a.y = wheelPos.y - 13;
              a.walkPhase += dt * 32;
              this.wheelSpinTimer = Math.max(this.wheelSpinTimer, 0.25);
              a.stateTimer -= dt;
              if (a.stateTimer <= 0) {
                // 다 달린 뒤 쳇바퀴 앞 바닥/창틀로 사뿐히 내려와 숨 고르기
                const downPos = this.resolveValidLandingPosition(wheelPos.x, wheelPos.y, id);
                a.x = downPos.x;
                a.y = downPos.y;
                a.state = "idle";
                a.stateTimer = 2.6 + Math.random() * 2.5;
              }
            } else {
              a.state = "idle";
              a.stateTimer = 2.0;
            }
          } else if (a.state === "crouch_jump") {
            // 고양이·햄스터가 점프하기 직전 잠깐 납작하게 웅크리는 단계
            a.stateTimer -= dt;
            if (a.stateTimer <= 0) {
              a.state = "jump_arc";
              a.jumpProgress = 0;
              a.jumpDuration = 0.46;
            }
          } else if (a.state === "jump_arc" || a.state === "fly") {
            a.jumpProgress = Math.min(1, a.jumpProgress + dt / a.jumpDuration);
            const t = a.jumpProgress;
            const arcH = a.state === "fly" ? 20 : 18;
            const arc = -Math.sin(t * Math.PI) * arcH;
            a.x = a.startX + (a.targetX - a.startX) * t;
            a.y = a.startY + (a.targetY - a.startY) * t + arc;
            if (a.jumpProgress >= 1) {
              a.x = a.targetX;
              a.y = a.targetY;
              if (a.nextActionAfterJump === "cat_tower_perch") {
                a.nextActionAfterJump = null;
                if (Math.random() < 0.6) {
                  a.state = "rest"; // 캣타워 발판 위에서 식빵 굽기 & 낮잠
                  a.stateTimer = 5.0 + Math.random() * 3.5;
                } else {
                  a.state = "play"; // 캣타워 위에서 앞발 세수(그루밍)
                  a.playType = 0;
                  a.stateTimer = 3.5 + Math.random() * 2.5;
                }
              } else if (a.nextActionAfterJump === "rest_on_cushion") {
                a.nextActionAfterJump = null;
                a.state = "rest";
                a.stateTimer = 5.0 + Math.random() * 3.5;
              } else if (
                a.nextActionAfterJump === "wheel_run" &&
                this.placedItems.has("hamster_wheel")
              ) {
                a.nextActionAfterJump = null;
                a.state = "wheel_run";
                a.stateTimer = 3.4 + Math.random() * 2.6;
                this.wheelSpinTimer = Math.max(this.wheelSpinTimer, a.stateTimer);
              } else {
                a.nextActionAfterJump = null;
                a.state = this.focusMode === "running" ? "rest" : "idle";
                a.stateTimer = 3.0 + Math.random() * 3.0;
              }
            }
          } else {
            // 'idle' | 'play' | 'rest': 지지대 없는 빈 벽 허공에 떠 있다면 즉시 가장 가까운 유효 착지 지점으로 부드럽게 안착
            if (!this.isOnValidRestingSurface(a.x, a.y, id)) {
              const landPos = this.resolveValidLandingPosition(a.x, a.y, id);
              a.startX = a.x;
              a.startY = a.y;
              a.targetX = landPos.x;
              a.targetY = landPos.y;
              if (Math.abs(landPos.x - a.x) > 2) {
                a.moveDir = landPos.x >= a.x ? 1 : -1;
              }
              a.jumpProgress = 0;
              a.jumpDuration = id === "cockatiel_bird" ? 0.42 : 0.34;
              a.state = id === "cockatiel_bird" ? "fly" : "jump_arc";
            } else if (this.focusMode !== "running") {
              a.stateTimer -= dt;
              if (a.stateTimer <= 0) {
                this.pickNextAnimalState(id, a);
              }
            }
          }
        }

        // 루트 그룹 위치 적용 (방향 반전은 내부 visual 그룹에서 수행하여 Zzz 텍스트 반전 방지)
        let rootOffsetY = 0;
        if (id === "white_rabbit" && a.state === "walk") {
          // 토끼: 걸을 때 깡총깡총 연속 작은 포물선 점프
          rootOffsetY = -Math.abs(Math.sin(a.walkPhase)) * 8.5;
        } else if (id === "hamster_friend" && a.state === "wheel_run") {
          // 햄스터가 쳇바퀴 안에서 신나게 달릴 때 통통거리는 리듬감
          rootOffsetY = -Math.abs(Math.sin(a.walkPhase * 1.4)) * 2.2;
        }
        el.setAttribute(
          "transform",
          `translate(${a.x.toFixed(1)}, ${(a.y + rootOffsetY).toFixed(1)})`
        );

        // 각 동물별 세부 파츠 애니메이션 적용 (해당 인스턴스 DOM 루트 스코프)
        this.applySpeciesDetailAnimation(id, a, elapsedSec, el);
    }

    /**
     * 동물 8종별 사실적인 고유 모션 디테일 적용 (방향 전환 Flip + 숨쉬기 + 걸음걸이 + 장난 + 휴식)
     */
    applySpeciesDetailAnimation(id, a, elapsedSec, rootEl = null) {
      const root = rootEl || this.svg?.querySelector(`#prop-${id}`);
      if (!root) return;
      const seed = a.animSeed || 0;
      const scaleX = this.getScaleXForDir(id, a.moveDir);
      // 기본 호흡(idle/rest 시 미세한 상하 호흡)
      const breathSy = 1 + Math.sin(elapsedSec * 3.2 + a.x + seed) * 0.024;
      const isBlink = Math.sin(elapsedSec * 1.9 + a.y + seed) > 0.95;

      // 1) 기존 창가 고양이 (window_cat)
      if (id === "window_cat") {
        const visual = root.querySelector('[data-part="wcat-visual"]');
        const legs = root.querySelector('[data-part="wcat-walk-legs"]');
        const groomPaw = root.querySelector('[data-part="wcat-groom-paw"]');
        const head = root.querySelector('[data-part="wcat-head"]');
        const tail = root.querySelector('[data-part="cat-tail-path"]');
        const zzz = root.querySelector('[data-part="cat-zzz"]');

        let sx = scaleX;
        let sy = breathSy;

        if (a.state === "crouch_jump") {
          sx = scaleX * 1.12;
          sy = 0.82;
        } else if (a.state === "play" && a.playType === 1) {
          // 등을 둥글게 말아 기지개 쭉 켜기
          const stretch = Math.sin(elapsedSec * 3.5) * 0.12;
          sx = scaleX * (1 - stretch * 0.6);
          sy = 1 + stretch;
        } else if (a.state === "react") {
          const p = Math.sin(a.reactTimer * Math.PI);
          sy = 1 + p * 0.14;
        }

        if (visual) {
          visual.setAttribute("transform", `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`);
        }

        // 사뿐사뿐 걷기 다리
        if (legs) {
          if (a.state === "walk") {
            legs.style.display = "block";
            const s = Math.sin(a.walkPhase * 1.6) * 2.8;
            root.querySelector('[data-part="wcat-leg-fl"]')?.setAttribute("x2", String(-14 + s));
            root.querySelector('[data-part="wcat-leg-fr"]')?.setAttribute("x2", String(-8 - s));
            root.querySelector('[data-part="wcat-leg-bl"]')?.setAttribute("x2", String(10 - s));
            root.querySelector('[data-part="wcat-leg-br"]')?.setAttribute("x2", String(16 + s));
          } else {
            legs.style.display = "none";
          }
        }

        // 앞발로 얼굴 닦기(그루밍)
        if (groomPaw && head) {
          if (a.state === "play" && a.playType === 0) {
            groomPaw.style.display = "block";
            const rubY = -12 + Math.sin(elapsedSec * 12) * 2.5;
            groomPaw.setAttribute("cy", rubY.toFixed(1));
            head.setAttribute("transform", `rotate(${(Math.sin(elapsedSec * 6) * 5).toFixed(1)} -13 -15)`);
          } else {
            groomPaw.style.display = "none";
            head.setAttribute("transform", "rotate(0)");
          }
        }

        if (tail) {
          const tailSpeed = a.state === "rest" ? 1.8 : 3.6;
          const tailSway = Math.sin(elapsedSec * tailSpeed) * 3.2;
          tail.setAttribute(
            "d",
            `M21 -3 C29 ${1 + tailSway}, 32 ${11 + tailSway}, 26 15 C21 18, 18 12, 20 7`
          );
        }

        if (zzz) {
          zzz.style.display = a.state === "rest" ? "block" : "none";
          const floatY = Math.sin(elapsedSec * 2.2) * 2.5;
          zzz.setAttribute("transform", `translate(0, ${floatY.toFixed(1)})`);
        }
        return;
      }

      // 2) 턱시도 고양이 (tuxedo_cat)
      if (id === "tuxedo_cat") {
        const visual = root.querySelector('[data-part="tuxedo-visual"]');
        const legs = root.querySelector('[data-part="tuxedo-walk-legs"]');
        const groomPaw = root.querySelector('[data-part="tuxedo-groom-paw"]');
        const head = root.querySelector('[data-part="tuxedo-head"]');
        const eyesOpen = root.querySelector('[data-part="tuxedo-eyes-open"]');
        const eyesClosed = root.querySelector('[data-part="tuxedo-eyes-closed"]');
        const tail = root.querySelector('[data-part="tuxedo-tail"]');
        const zzz = root.querySelector('[data-part="tuxedo-zzz"]');

        let sx = scaleX;
        let sy = breathSy;

        if (a.state === "crouch_jump") {
          sx = scaleX * 1.12;
          sy = 0.82;
        } else if ((a.state === "play" && a.playType === 1) || a.state === "react") {
          // 등을 둥글게 말아 기지개 쭉 켜기
          const stretch = Math.sin(elapsedSec * 4) * 0.14;
          sx = scaleX * (1 + stretch);
          sy = 1 - stretch * 0.7;
        }

        if (visual) {
          visual.setAttribute("transform", `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`);
        }

        if (legs) {
          if (a.state === "walk") {
            legs.style.display = "block";
            const s = Math.sin(a.walkPhase * 1.6) * 2.6;
            root.querySelector('[data-part="tux-leg-fl"]')?.setAttribute("x2", String(-12 + s));
            root.querySelector('[data-part="tux-leg-fr"]')?.setAttribute("x2", String(-5 - s));
            root.querySelector('[data-part="tux-leg-bl"]')?.setAttribute("x2", String(7 - s));
            root.querySelector('[data-part="tux-leg-br"]')?.setAttribute("x2", String(13 + s));
          } else {
            legs.style.display = "none";
          }
        }

        // 앞발로 세수(그루밍)
        if (groomPaw && head) {
          if (a.state === "play" && a.playType === 0) {
            const rubY = -12 + Math.sin(elapsedSec * 12) * 3.2;
            groomPaw.setAttribute("cy", rubY.toFixed(1));
            groomPaw.setAttribute("cx", "-13");
            head.setAttribute("transform", `translate(-8, -21) rotate(${(Math.sin(elapsedSec * 6) * 6).toFixed(1)})`);
          } else {
            groomPaw.setAttribute("cx", "-1");
            groomPaw.setAttribute("cy", "-1");
            head.setAttribute("transform", "translate(-8, -21)");
          }
        }

        const shouldCloseEyes = a.state === "rest" || isBlink;
        if (eyesOpen) eyesOpen.style.display = shouldCloseEyes ? "none" : "block";
        if (eyesClosed) eyesClosed.style.display = shouldCloseEyes ? "block" : "none";

        if (tail) {
          const sway = Math.sin(elapsedSec * (a.state === "rest" ? 1.8 : 3.8)) * 4;
          tail.setAttribute("d", `M18 -4 C27 ${-4 + sway}, 30 ${-13 + sway}, 25 -17`);
        }

        if (zzz) {
          zzz.style.display = a.state === "rest" ? "block" : "none";
        }
        return;
      }

      // 3) 해바라기씨 햄스터 (hamster_friend)
      if (id === "hamster_friend") {
        const visual = root.querySelector('[data-part="ham-visual"]');
        const eyesOpen = root.querySelector('[data-part="ham-eyes-open"]');
        const eyesClosed = root.querySelector('[data-part="ham-eyes-closed"]');
        const handsSeed = root.querySelector('[data-part="ham-hands-seed"]');
        const seed = root.querySelector('[data-part="ham-seed"]');
        const footL = root.querySelector('[data-part="ham-foot-l"]');
        const footR = root.querySelector('[data-part="ham-foot-r"]');
        const zzz = root.querySelector('[data-part="ham-zzz"]');

        let sx = scaleX;
        let sy = breathSy;

        if (a.state === "rest") {
          // 동그랗게 찹쌀떡처럼 웅크려 졸기
          sx = scaleX * 1.07;
          sy = 0.89 + Math.sin(elapsedSec * 2.5) * 0.02;
        }

        if (visual) {
          visual.setAttribute("transform", `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`);
        }

        if ((a.state === "walk" && a.pauseDuringWalk <= 0) || a.state === "wheel_run") {
          const mult = a.state === "wheel_run" ? 3.4 : 2.4;
          const amp = a.state === "wheel_run" ? 2.4 : 1.6;
          const step = Math.sin(a.walkPhase * mult) * amp;
          footL?.setAttribute("cy", (-Math.max(0, step)).toFixed(1));
          footR?.setAttribute("cy", (-Math.max(0, -step)).toFixed(1));
        } else {
          footL?.setAttribute("cy", "0");
          footR?.setAttribute("cy", "0");
        }

        if (handsSeed && seed) {
          if (a.state === "wheel_run") {
            // 쳇바퀴 달리는 중에는 해바라기씨를 숨기고 두 앞발도 리듬감 있게 달리기
            seed.style.display = "none";
            const runHandsY = Math.sin(a.walkPhase * 3.4) * 1.6;
            handsSeed.setAttribute("transform", `translate(0, ${runHandsY.toFixed(1)})`);
          } else if (a.state === "play" || a.state === "react") {
            if (a.playType === 0 || a.state === "react") {
              // 양손으로 해바라기씨 오물거리며 먹기
              seed.style.display = "block";
              const nibbleY = Math.sin(elapsedSec * 26) * 1.3;
              handsSeed.setAttribute("transform", `translate(0, ${nibbleY.toFixed(1)})`);
            } else {
              // 앞발로 볼 닦기(세수)
              seed.style.display = "none";
              const rubY = -2 + Math.sin(elapsedSec * 16) * 2.2;
              handsSeed.setAttribute("transform", `translate(0, ${rubY.toFixed(1)})`);
            }
          } else {
            seed.style.display = "block";
            handsSeed.setAttribute("transform", "translate(0, 0)");
          }
        }

        const closeEyes = a.state === "rest" || isBlink;
        if (eyesOpen) eyesOpen.style.display = closeEyes ? "none" : "block";
        if (eyesClosed) eyesClosed.style.display = closeEyes ? "block" : "none";
        if (zzz) zzz.style.display = a.state === "rest" ? "block" : "none";
        return;
      }

      // 4) 왕관앵무 (cockatiel_bird)
      if (id === "cockatiel_bird") {
        const visual = root.querySelector('[data-part="cockatiel-visual"]');
        const head = root.querySelector('[data-part="cockatiel-head"]');
        const wing = root.querySelector('[data-part="cockatiel-wing"]');
        const footL = root.querySelector('[data-part="cockatiel-foot-l"]');
        const footR = root.querySelector('[data-part="cockatiel-foot-r"]');
        const zzz = root.querySelector('[data-part="cockatiel-zzz"]');

        if (visual) {
          visual.setAttribute("transform", `scale(${scaleX}, ${breathSy.toFixed(3)})`);
        }

        // 날갯짓 비행 또는 날개 깃털 다듬기
        if (wing) {
          if (a.state === "fly") {
            const flap = Math.sin(elapsedSec * 28) * 7;
            wing.setAttribute("d", `M-2 -15 C${4 + flap} ${-14 - flap}, 7 -7, 3 -2`);
          } else if (a.state === "play" && a.playType === 0) {
            // 날개 깃털 다듬기
            const preen = Math.abs(Math.sin(elapsedSec * 12)) * 4;
            wing.setAttribute("d", `M-2 -15 C${4 + preen} ${-13}, ${7 + preen} -6, 3 -2`);
          } else {
            wing.setAttribute("d", "M-2 -15 C4 -14, 7 -7, 3 -2");
          }
        }

        // 고개 갸웃거리기 / 깃털 다듬기 시 고개 돌리기
        if (head) {
          if (a.state === "react" || (a.state === "play" && a.playType === 1)) {
            const tilt = Math.sin(elapsedSec * 11) * 19;
            head.setAttribute("transform", `translate(-2, -25) rotate(${tilt.toFixed(1)})`);
          } else if (a.state === "play" && a.playType === 0) {
            head.setAttribute("transform", "translate(-1, -24) rotate(22)");
          } else if (a.state === "rest") {
            head.setAttribute("transform", "translate(-1.5, -23.5) rotate(8)");
          } else {
            head.setAttribute("transform", "translate(-2, -25)");
          }
        }

        // 창틀/집중 버튼 위에서 종종걸음으로 걷기
        if (a.state === "walk") {
          const step = Math.sin(a.walkPhase * 2.2) * 1.5;
          footL?.setAttribute("y2", (1.5 - Math.max(0, step)).toFixed(1));
          footR?.setAttribute("y2", (1.5 - Math.max(0, -step)).toFixed(1));
        } else {
          footL?.setAttribute("y2", "1.5");
          footR?.setAttribute("y2", "1.5");
        }

        if (zzz) zzz.style.display = a.state === "rest" ? "block" : "none";
        return;
      }

      // 5) 웰시코기 (welsh_corgi)
      if (id === "welsh_corgi") {
        const visual = root.querySelector('[data-part="corgi-visual"]');
        const poseNormal = root.querySelector('[data-part="corgi-pose-normal"]');
        const poseBelly = root.querySelector('[data-part="corgi-pose-belly"]');
        const legsGroup = root.querySelector('[data-part="corgi-legs-group"]');
        const rump = root.querySelector('[data-part="corgi-rump"]');
        const eyeOpen = root.querySelector('[data-part="corgi-eye-open"]');
        const eyeClosed = root.querySelector('[data-part="corgi-eye-closed"]');
        const zzz = root.querySelector('[data-part="corgi-zzz"]');

        if (a.state === "play") {
          // 바닥에 배를 보이고 뒤집어져 데굴데굴 장난치기
          if (poseNormal) poseNormal.style.display = "none";
          if (poseBelly) {
            poseBelly.style.display = "block";
            const rollDeg = Math.sin(elapsedSec * 7.5) * 11;
            poseBelly.setAttribute("transform", `rotate(${rollDeg.toFixed(1)} 0 -8)`);
            const pad = Math.sin(elapsedSec * 20) * 2.5;
            root.querySelector('[data-part="corgi-paw-up-1"]')?.setAttribute("y2", String(-21 + pad));
            root.querySelector('[data-part="corgi-paw-up-2"]')?.setAttribute("y2", String(-21 - pad));
            root.querySelector('[data-part="corgi-paw-up-3"]')?.setAttribute("y2", String(-21 - pad));
            root.querySelector('[data-part="corgi-paw-up-4"]')?.setAttribute("y2", String(-21 + pad));
          }
          if (visual) visual.setAttribute("transform", `scale(${scaleX}, 1)`);
          if (zzz) zzz.style.display = "none";
          return;
        }

        if (poseNormal) poseNormal.style.display = "block";
        if (poseBelly) poseBelly.style.display = "none";

        let sy = breathSy;
        let offsetY = 0;

        if (a.state === "rest") {
          // 식빵 자세로 다리를 쏙 넣고 쉬기
          if (legsGroup) legsGroup.style.display = "none";
          offsetY = 4.5;
          sy = 0.94 + Math.sin(elapsedSec * 2.5) * 0.02;
        } else {
          if (legsGroup) legsGroup.style.display = "block";
        }

        if (visual) {
          visual.setAttribute(
            "transform",
            `translate(0, ${offsetY}) scale(${scaleX}, ${sy.toFixed(3)})`
          );
        }

        if (a.state === "walk") {
          // 짧은 다리로 빠르게 총총 달리기 + 엉덩이 실룩거림
          const swing = Math.sin(a.walkPhase * 1.4) * 2.8;
          root.querySelector('[data-part="corgi-leg-bl"]')?.setAttribute("x2", String(-16 + swing));
          root.querySelector('[data-part="corgi-leg-br"]')?.setAttribute("x2", String(-9 - swing));
          root.querySelector('[data-part="corgi-leg-fl"]')?.setAttribute("x2", String(9 - swing));
          root.querySelector('[data-part="corgi-leg-fr"]')?.setAttribute("x2", String(16 + swing));
          if (rump) {
            const wig = Math.sin(a.walkPhase * 2) * 2.2;
            rump.setAttribute("transform", `translate(0, ${wig.toFixed(1)})`);
          }
        } else if (a.state === "react") {
          if (rump) {
            const wig = Math.sin(elapsedSec * 34) * 3.2;
            rump.setAttribute("transform", `translate(0, ${wig.toFixed(1)})`);
          }
        } else {
          root.querySelector('[data-part="corgi-leg-bl"]')?.setAttribute("x2", "-16");
          root.querySelector('[data-part="corgi-leg-br"]')?.setAttribute("x2", "-9");
          root.querySelector('[data-part="corgi-leg-fl"]')?.setAttribute("x2", "9");
          root.querySelector('[data-part="corgi-leg-fr"]')?.setAttribute("x2", "16");
          if (rump) rump.setAttribute("transform", "translate(0, 0)");
        }

        const closeEye = a.state === "rest" || isBlink;
        if (eyeOpen) eyeOpen.style.display = closeEye ? "none" : "block";
        if (eyeClosed) eyeClosed.style.display = closeEye ? "block" : "none";
        if (zzz) zzz.style.display = a.state === "rest" ? "block" : "none";
        return;
      }

      // 6) 꼬마 거북이 (little_turtle)
      if (id === "little_turtle") {
        const visual = root.querySelector('[data-part="turtle-visual"]');
        const limbs = root.querySelector('[data-part="turtle-limbs"]');
        const bodyWrap = root.querySelector('[data-part="turtle-body-wrap"]');
        const headGroup = root.querySelector('[data-part="turtle-head-group"]');
        const legBl = root.querySelector('[data-part="turtle-leg-bl"]');
        const legFl = root.querySelector('[data-part="turtle-leg-fl"]');
        const zzz = root.querySelector('[data-part="turtle-zzz"]');

        if (visual) {
          visual.setAttribute("transform", `scale(${scaleX}, ${breathSy.toFixed(3)})`);
        }

        // 등껍질 속으로 쏙 들어가 휴식(rest) 또는 클릭 반응(react)
        if (a.state === "rest" || a.state === "react") {
          if (limbs) limbs.style.display = "none";
          if (bodyWrap) bodyWrap.setAttribute("transform", "translate(0, 2)");
          if (zzz) zzz.style.display = a.state === "rest" ? "block" : "none";
          return;
        }

        if (limbs) limbs.style.display = "block";
        if (bodyWrap) bodyWrap.setAttribute("transform", "translate(0, 0)");
        if (zzz) zzz.style.display = "none";

        // 아주 느긋하게 네 발을 번갈아 움직이며 기어가기
        if (a.state === "walk") {
          const step = Math.sin(a.walkPhase * 2.2) * 2.2;
          legBl?.setAttribute("cx", (-11.5 + step).toFixed(1));
          legFl?.setAttribute("cx", (9.5 - step).toFixed(1));
        } else {
          legBl?.setAttribute("cx", "-11.5");
          legFl?.setAttribute("cx", "9.5");
        }

        // 목을 쭉 빼고 좌우 두리번거리기 (play)
        if (headGroup) {
          if (a.state === "play") {
            const stretchX = 2.5 + Math.sin(elapsedSec * 3) * 1.2;
            const lookY = -2 + Math.cos(elapsedSec * 5) * 1.5;
            headGroup.setAttribute("transform", `translate(${stretchX.toFixed(1)}, ${lookY.toFixed(1)})`);
          } else {
            headGroup.setAttribute("transform", "translate(0, 0)");
          }
        }
        return;
      }

      // 7) 고슴도치 (hedgehog_friend)
      if (id === "hedgehog_friend") {
        const visual = root.querySelector('[data-part="hedgehog-visual"]');
        const normal = root.querySelector('[data-part="hedgehog-normal"]');
        const ball = root.querySelector('[data-part="hedgehog-ball"]');
        const snout = root.querySelector('[data-part="hedgehog-snout"]');
        const footL = root.querySelector('[data-part="hedge-foot-l"]');
        const footR = root.querySelector('[data-part="hedge-foot-r"]');
        const zzz = root.querySelector('[data-part="hedgehog-zzz"]');

        if (visual) {
          visual.setAttribute("transform", `scale(${scaleX}, ${breathSy.toFixed(3)})`);
        }

        // 동그랗게 공처럼 말려서 쉬기(rest) 또는 클릭 반응(react)
        if (a.state === "rest" || a.state === "react") {
          if (normal) normal.style.display = "none";
          if (ball) {
            ball.style.display = "block";
            const rockSpeed = a.state === "react" ? 20 : 3.5;
            const rockAmp = a.state === "react" ? 15 : 4;
            const rock = Math.sin(elapsedSec * rockSpeed) * rockAmp;
            ball.setAttribute("transform", `rotate(${rock.toFixed(1)} 0 -12)`);
          }
          if (zzz) zzz.style.display = a.state === "rest" ? "block" : "none";
          return;
        }

        if (normal) normal.style.display = "block";
        if (ball) ball.style.display = "none";
        if (zzz) zzz.style.display = "none";

        // 아장아장 걷기
        if (a.state === "walk") {
          const s = Math.sin(a.walkPhase * 1.8) * 1.8;
          footL?.setAttribute("x2", (-9 + s).toFixed(1));
          footR?.setAttribute("x2", (6 - s).toFixed(1));
        } else {
          footL?.setAttribute("x2", "-9");
          footR?.setAttribute("x2", "6");
        }

        // 코를 킁킁거리며 바닥 탐색하기 (play)
        if (snout) {
          if (a.state === "play") {
            const sniffDip = 1.5 + Math.sin(elapsedSec * 18) * 1.4;
            snout.setAttribute("transform", `translate(0.8, ${sniffDip.toFixed(1)})`);
          } else {
            snout.setAttribute("transform", "translate(0, 0)");
          }
        }
        return;
      }

      // 8) 하얀 토끼 (white_rabbit)
      if (id === "white_rabbit") {
        const visual = root.querySelector('[data-part="rabbit-visual"]');
        const bodyGroup = root.querySelector('[data-part="rabbit-body-group"]');
        const ears = root.querySelector('[data-part="rabbit-ears"]');
        const eyeOpen = root.querySelector('[data-part="rabbit-eye-open"]');
        const eyeClosed = root.querySelector('[data-part="rabbit-eye-closed"]');
        const zzz = root.querySelector('[data-part="rabbit-zzz"]');

        let sx = scaleX;
        let sy = breathSy;

        if (a.state === "crouch_jump") {
          sx = scaleX * 1.12;
          sy = 0.82;
        } else if (a.state === "rest") {
          // 바닥에 옆으로 길게 누워 쉬기 (Bunny Flop)
          sx = scaleX * 1.18;
          sy = 0.78 + Math.sin(elapsedSec * 2.5) * 0.02;
        }

        if (visual) {
          visual.setAttribute("transform", `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`);
        }

        // 뒷발로 살짝 서서 긴 귀 쫑긋거리기 (play / react)
        if (bodyGroup && ears) {
          if (a.state === "play" || a.state === "react") {
            bodyGroup.setAttribute("transform", "translate(-2, -3) rotate(-14 0 0)");
            const twitch = Math.sin(elapsedSec * 22) * 14;
            ears.setAttribute("transform", `rotate(${twitch.toFixed(1)} 9 -22)`);
          } else if (a.state === "rest") {
            bodyGroup.setAttribute("transform", "translate(0, 0)");
            ears.setAttribute("transform", "rotate(-22 9 -22)");
          } else {
            bodyGroup.setAttribute("transform", "translate(0, 0)");
            const subtleEar = Math.sin(elapsedSec * 3) * 3;
            ears.setAttribute("transform", `rotate(${subtleEar.toFixed(1)} 9 -22)`);
          }
        }

        const closeEye = a.state === "rest" || isBlink;
        if (eyeOpen) eyeOpen.style.display = closeEye ? "none" : "block";
        if (eyeClosed) eyeClosed.style.display = closeEye ? "block" : "none";
        if (zzz) zzz.style.display = a.state === "rest" ? "block" : "none";
      }
    }

    update(dt, elapsedSec) {
      if (!this.svg) return;

      // 1. 테니스공 통통 튀기 애니메이션 (모든 인스턴스 대응)
      if (this.ballBounce > 0) {
        this.ballBounce = Math.max(0, this.ballBounce - dt * 1.8);
        const bounceY = Math.abs(Math.sin(elapsedSec * 14)) * 16 * this.ballBounce;
        this.svg.querySelectorAll('[data-part="ball-body"]').forEach((ballBody) => {
          ballBody.setAttribute("transform", `translate(0, ${-bounceY.toFixed(1)})`);
        });
      }

      // 1-B. 인터랙티브 소품 애니메이션 (오리 삑삑이, 햄스터 쳇바퀴, 빈티지 턴테이블, 아로마 캔들, 반짝 스노우볼 — 모든 중복 인스턴스 공통)
      if (this.duckSqueakTimer > 0) {
        this.duckSqueakTimer = Math.max(0, this.duckSqueakTimer - dt * 1.9);
        const p = this.duckSqueakTimer;
        const jumpY = -Math.abs(Math.sin(elapsedSec * 18)) * 7 * p;
        const sx = 1 + Math.sin(elapsedSec * 24) * 0.14 * p;
        const sy = 1 - Math.sin(elapsedSec * 24) * 0.14 * p;
        this.svg.querySelectorAll('[data-part="duck-toy-body"]').forEach((duckBody) => {
          duckBody.setAttribute(
            "transform",
            `translate(0, ${jumpY.toFixed(1)}) scale(${sx.toFixed(2)}, ${sy.toFixed(2)})`
          );
        });
      }

      if (this.wheelSpinTimer > 0) {
        this.wheelSpinTimer = Math.max(0, this.wheelSpinTimer - dt);
        this.wheelSpinAngle = (this.wheelSpinAngle + dt * 420 * Math.min(1, this.wheelSpinTimer)) % 360;
        this.svg.querySelectorAll('[data-part="hamster-wheel-rotor"]').forEach((rotor) => {
          rotor.setAttribute("transform", `rotate(${this.wheelSpinAngle.toFixed(1)})`);
        });
      }

      if (this.turntablePlayTimer > 0) {
        this.turntablePlayTimer = Math.max(0, this.turntablePlayTimer - dt);
        const pulse = 1 + Math.sin(elapsedSec * 12) * 0.08;
        const floatY = -((3.2 - this.turntablePlayTimer) * 4.2) % 12;
        const swayX = Math.sin(elapsedSec * 6) * 2.5;
        const alpha = Math.min(1, this.turntablePlayTimer * 1.2);
        this.svg.querySelectorAll('[data-part="turntable-disc-label"]').forEach((discLabel) => {
          discLabel.setAttribute("transform", `scale(${pulse.toFixed(2)}, 1)`);
        });
        this.svg.querySelectorAll('[data-part="turntable-notes"]').forEach((notes) => {
          notes.setAttribute("opacity", alpha.toFixed(2));
          notes.setAttribute("transform", `translate(${swayX.toFixed(1)}, ${floatY.toFixed(1)})`);
        });
      } else {
        this.svg.querySelectorAll('[data-part="turntable-notes"]').forEach((notes) => {
          if (notes.getAttribute("opacity") !== "0") {
            notes.setAttribute("opacity", "0");
          }
        });
      }

      if (this.placedItems.has("aroma_candle")) {
        this.svg.querySelectorAll('[data-part="candle-flame-aroma_candle"]').forEach((flame, idx) => {
          if (flame.style.display !== "none") {
            const phase = idx * 1.7;
            const flickerRot = Math.sin(elapsedSec * 11 + phase) * 4;
            const flickerSy = 1 + Math.sin(elapsedSec * 15 + phase) * 0.07;
            flame.setAttribute(
              "transform",
              `translate(0, -20.5) rotate(${flickerRot.toFixed(1)}) scale(1, ${flickerSy.toFixed(2)}) translate(0, 20.5)`
            );
          }
        });
      }

      if (this.snowGlobeShakeTimer > 0) {
        this.snowGlobeShakeTimer = Math.max(0, this.snowGlobeShakeTimer - dt);
        const shakeX = this.snowGlobeShakeTimer > 1.8 ? Math.sin(elapsedSec * 36) * 2.2 : 0;
        const swirlX = Math.sin(elapsedSec * 10) * 2.4;
        const swirlY = Math.cos(elapsedSec * 8) * 2.4;
        this.svg.querySelectorAll('[data-part="snow-globe-wrap"]').forEach((wrap) => {
          wrap.setAttribute("transform", `translate(${shakeX.toFixed(1)}, 0)`);
        });
        this.svg.querySelectorAll('[data-part="snow-globe-flakes"]').forEach((flakes) => {
          flakes.setAttribute("transform", `translate(${swirlX.toFixed(1)}, ${swirlY.toFixed(1)})`);
        });
      }

      // 2. 동물 9종(1번 원본) 상태 머신 및 고유 모션 업데이트
      this.updateCompanionPets(dt, elapsedSec);

      // 2-1. 중복 배치된 복제 동물(#2/#3 전 종) instanceId별 통합 세부 행동·모션 업데이트
      this.updateExtraPets(dt, elapsedSec);

      // 3. 기본 강아지(1번 원본) 5단계 상태 머신 업데이트
      if (this.placedItems.has("living_room_dog")) {
        const dogGroup = this.svg.querySelector("#dog-character");
        const isPrimaryDogDragging =
          Boolean(this.dragState) &&
          !this.dragState.isExtraInstance &&
          this.dragState.itemId === "living_room_dog" &&
          this.dragState.isDragging;
        this.updateDogInstance(dogGroup, this.dog, dt, elapsedSec, isPrimaryDogDragging);
      }
    }

    /**
     * 크로키 강아지(living_room_dog) 단일 인스턴스(1번·2번·3번 공통) 5단계 행동·파츠 모션 업데이트
     */
    updateDogInstance(dogGroup, d, dt, elapsedSec, isDragging) {
      if (!dogGroup || !d || isDragging) return;

      const dogVisual = dogGroup.querySelector('[data-part="dog-visual"]');
      const poseActive = dogGroup.querySelector('[data-part="dog-pose-active"]');
      const bodyAnimWrap = dogGroup.querySelector('[data-part="dog-body-anim-wrap"]');
      const poseSleep = dogGroup.querySelector('[data-part="dog-pose-sleep"]');
      const sleepZzz = dogGroup.querySelector('[data-part="dog-sleep-zzz"]');
      const dogHead = dogGroup.querySelector('[data-part="dog-head"]');
      const dogEye = dogGroup.querySelector('[data-part="dog-eye"]');
      const tailEl = dogGroup.querySelector('[data-part="dog-tail"]');
      const seed = d.animSeed || 0;

      if (d.userHoldTimer > 0) {
        d.userHoldTimer = Math.max(0, d.userHoldTimer - dt);
      }

      // 빈 벽 허공에 강아지를 드래그해 놓았을 때 바닥/방석으로 부드럽게 안착
      if (d.settleActive) {
        d.settleProgress = Math.min(1, (d.settleProgress || 0) + dt / 0.32);
        const ease = 1 - Math.pow(1 - d.settleProgress, 3);
        d.x = d.settleStartX + (d.settleTargetX - d.settleStartX) * ease;
        d.baseY = d.settleStartY + (d.settleTargetY - d.settleStartY) * ease;
        if (d.settleProgress >= 1) {
          d.x = d.settleTargetX;
          d.baseY = d.settleTargetY;
          d.targetX = d.settleTargetX;
          d.targetY = d.settleTargetY;
          d.settleActive = false;
        }
      } else if (!this.isOnValidRestingSurface(d.x, d.baseY, "living_room_dog")) {
        const landPos = this.resolveValidLandingPosition(d.x, d.baseY, "living_room_dog");
        d.settleActive = true;
        d.settleStartX = d.x;
        d.settleStartY = d.baseY;
        d.settleTargetX = landPos.x;
        d.settleTargetY = landPos.y;
        d.settleProgress = 0;
      }

      if (d.reactTimer > 0) {
        d.reactTimer = Math.max(0, d.reactTimer - dt);
        if (d.reactTimer <= 0 && d.state === "react") {
          d.state = "idle";
          d.stateTimer = 2.5;
        }
      }

      if (this.focusMode === "running") {
        const dx = d.targetX - d.x;
        const dy = d.targetY - d.baseY;
        const dist = Math.hypot(dx, dy);
        if (d.userHoldTimer <= 0 && dist > 3) {
          d.moveDir = dx >= 0 ? 1 : -1;
          d.x += (dx / dist) * 46 * dt;
          d.baseY += (dy / dist) * 46 * dt;
          d.walkCycle += dt * 9;
          this.setDogLegs(Math.sin(d.walkCycle) * 4.5, dogGroup);
          if (poseActive) poseActive.style.display = "block";
          if (poseSleep) poseSleep.style.display = "none";
          if (sleepZzz) sleepZzz.style.display = "none";
        } else {
          d.state = "rest";
          if (poseActive) poseActive.style.display = "none";
          if (poseSleep) poseSleep.style.display = "block";
          if (sleepZzz) sleepZzz.style.display = "block";
        }
      } else {
        if (d.state === "rest") {
          if (poseActive) poseActive.style.display = "none";
          if (poseSleep) poseSleep.style.display = "block";
          if (sleepZzz) sleepZzz.style.display = "block";
          if (d.userHoldTimer <= 0) {
            d.stateTimer -= dt;
            if (d.stateTimer <= 0) this.pickNextDogState(d);
          }
        } else {
          if (poseActive) poseActive.style.display = "block";
          if (poseSleep) poseSleep.style.display = "none";
          if (sleepZzz) sleepZzz.style.display = "none";

          if (d.state === "walk") {
            if (bodyAnimWrap) bodyAnimWrap.setAttribute("transform", "translate(0, 0)");
            if (dogHead) dogHead.setAttribute("transform", "translate(18, -14)");

            const dx = d.targetX - d.x;
            const dy = d.targetY - d.baseY;
            const dist = Math.hypot(dx, dy);

            if (dist <= 3) {
              d.x = d.targetX;
              d.baseY = d.targetY;
              if (d.nextActionAfterWalk === "rest_on_cushion") {
                d.nextActionAfterWalk = null;
                d.state = "rest";
                d.stateTimer = 5.5 + Math.random() * 3.5; // 베이지 방석 위에서 포근하게 낮잠
              } else {
                d.nextActionAfterWalk = null;
                d.state = "idle";
                d.stateTimer = 2.8 + Math.random() * 2.5;
              }
              this.setDogLegs(0, dogGroup);
            } else {
              if (Math.abs(dx) > 0.8) {
                d.moveDir = dx >= 0 ? 1 : -1;
              }
              const speed = 48;
              d.x += (dx / dist) * speed * dt;
              d.baseY += (dy / dist) * speed * dt;
              d.walkCycle += dt * 10;
              this.setDogLegs(Math.sin(d.walkCycle) * 4.8, dogGroup);
            }
          } else if (d.state === "play" || d.state === "react") {
            if (d.playSubMode === "patter" && d.state !== "react") {
              // 바닥에 배 깔고 엎드려 앞발 꼼지락 장난치기
              if (bodyAnimWrap) bodyAnimWrap.setAttribute("transform", "translate(0, 6)");
              const patter = Math.sin(elapsedSec * 22 + seed) * 3.5;
              dogGroup.querySelector('[data-part="dog-leg-bl"]')?.setAttribute("x2", "-16");
              dogGroup.querySelector('[data-part="dog-leg-bl"]')?.setAttribute("y2", "11");
              dogGroup.querySelector('[data-part="dog-leg-br"]')?.setAttribute("x2", "-8");
              dogGroup.querySelector('[data-part="dog-leg-br"]')?.setAttribute("y2", "11");
              dogGroup.querySelector('[data-part="dog-leg-fl"]')?.setAttribute("x2", (19 + patter).toFixed(1));
              dogGroup.querySelector('[data-part="dog-leg-fl"]')?.setAttribute("y2", "11");
              dogGroup.querySelector('[data-part="dog-leg-fr"]')?.setAttribute("x2", (23 - patter).toFixed(1));
              dogGroup.querySelector('[data-part="dog-leg-fr"]')?.setAttribute("y2", "11");
              if (dogHead) {
                const dip = Math.sin(elapsedSec * 8 + seed) * 2;
                dogHead.setAttribute("transform", `translate(19, ${(-12 + dip).toFixed(1)})`);
              }
            } else {
              // 기지개 켜기 (Play Bow)
              const bowAngle = -8 + Math.sin(elapsedSec * 5 + seed) * 2.5;
              if (bodyAnimWrap) {
                bodyAnimWrap.setAttribute("transform", `translate(0, 2) rotate(${bowAngle.toFixed(1)})`);
              }
              dogGroup.querySelector('[data-part="dog-leg-fl"]')?.setAttribute("x2", "20");
              dogGroup.querySelector('[data-part="dog-leg-fr"]')?.setAttribute("x2", "24");
              dogGroup.querySelector('[data-part="dog-leg-fl"]')?.setAttribute("y2", "16");
              dogGroup.querySelector('[data-part="dog-leg-fr"]')?.setAttribute("y2", "16");
              dogGroup.querySelector('[data-part="dog-leg-bl"]')?.setAttribute("y2", "17");
              dogGroup.querySelector('[data-part="dog-leg-br"]')?.setAttribute("y2", "17");
            }

            if (d.state === "play" && d.userHoldTimer <= 0) {
              d.stateTimer -= dt;
              if (d.stateTimer <= 0) {
                this.resetDogPoseNeutral(dogGroup);
                this.pickNextDogState(d);
              }
            }
          } else {
            // 'idle': 숨쉬기 + 눈 깜빡임 + 꼬리 살랑이기
            this.resetDogPoseNeutral(dogGroup);
            if (d.userHoldTimer <= 0) {
              d.stateTimer -= dt;
              if (d.stateTimer <= 0) {
                this.pickNextDogState(d);
              }
            }
          }
        }
      }

      // 강아지 눈 깜빡임 (개체별 시드 분산)
      if (dogEye) {
        const blink = Math.sin(elapsedSec * 2.1 + seed) > 0.96;
        dogEye.setAttribute("ry", blink ? "0.35" : "1.7");
      }

      // 강아지 꼬리 살랑임 (개체별 시드 분산)
      if (tailEl) {
        const wagFreq = d.state === "play" || d.state === "react" ? 18 : 7.5;
        const wag = Math.sin(elapsedSec * wagFreq + seed) * 3.8;
        tailEl.setAttribute(
          "d",
          `M-19 -6 C-27 ${-12 + wag}, -29 ${-19 + wag}, -23 ${-21 + wag}`
        );
      }

      if (sleepZzz) {
        const zFloat = Math.sin(elapsedSec * 2.5 + seed) * 3;
        sleepZzz.setAttribute("transform", `translate(0, ${zFloat.toFixed(1)})`);
      }

      // 강아지 방향 전환(Flip) 및 미세 호흡 적용
      const dogScaleX = this.getScaleXForDir("living_room_dog", d.moveDir);
      const dogBreathSy = 1 + Math.sin(elapsedSec * 3.2 + seed) * 0.022;
      if (dogVisual) {
        dogVisual.setAttribute("transform", `scale(${dogScaleX}, ${dogBreathSy.toFixed(3)})`);
      }

      d.y = d.baseY;
      if (dogGroup) {
        dogGroup.setAttribute(
          "transform",
          `translate(${d.x.toFixed(1)}, ${d.y.toFixed(1)})`
        );
      }
    }

    resetDogPoseNeutral(rootEl = null) {
      const root = rootEl || this.svg?.querySelector("#dog-character");
      if (!root) return;
      const bodyAnimWrap = root.querySelector('[data-part="dog-body-anim-wrap"]');
      const dogHead = root.querySelector('[data-part="dog-head"]');
      if (bodyAnimWrap) bodyAnimWrap.setAttribute("transform", "translate(0, 0)");
      if (dogHead) dogHead.setAttribute("transform", "translate(18, -14)");
      this.setDogLegs(0, root);
    }

    setDogLegs(swing, rootEl = null) {
      const root = rootEl || this.svg?.querySelector("#dog-character");
      if (!root) return;
      const bl = root.querySelector('[data-part="dog-leg-bl"]');
      const br = root.querySelector('[data-part="dog-leg-br"]');
      const fl = root.querySelector('[data-part="dog-leg-fl"]');
      const fr = root.querySelector('[data-part="dog-leg-fr"]');
      if (!bl || !br || !fl || !fr) return;

      bl.setAttribute("x2", String(-14 + swing));
      bl.setAttribute("y2", "17");
      br.setAttribute("x2", String(-4 - swing));
      br.setAttribute("y2", "17");
      fl.setAttribute("x2", String(8 - swing));
      fl.setAttribute("y2", "17");
      fr.setAttribute("x2", String(18 + swing));
      fr.setAttribute("y2", "17");
    }
  }

  function VerticalGapFallback(gap) {
    return typeof gap === "number" ? gap : 14;
  }

  function clampPreviewItemPosition(itemId, rawX, rawY) {
    const bbox = ITEM_LOCAL_BBOX[itemId] || {
      top: 22,
      bottom: 22,
      left: 22,
      right: 22
    };
    const frameMinX = 16;
    const frameMaxX = VIEWBOX_W - 16;
    const frameMinY = VIEWBOX_MIN_Y + 14;
    const frameMaxY = VIEWBOX_MIN_Y + VIEWBOX_H - 18;

    const minX = frameMinX + bbox.left;
    const maxX = Math.max(minX, frameMaxX - bbox.right);
    const minY = frameMinY + bbox.top;
    const maxY = Math.max(minY, frameMaxY - bbox.bottom);

    return {
      x: Math.max(minX, Math.min(maxX, Number(rawX) || 190)),
      y: Math.max(minY, Math.min(maxY, Number(rawY) || 290))
    };
  }

  function resolvePreviewLandingPosition(itemId, rawX, rawY, placedSet) {
    const clamped = clampPreviewItemPosition(itemId, rawX, rawY);
    if (!ALL_LIVING_PETS.has(itemId)) return clamped;

    const bottomOffset = ITEM_BOTTOM_OFFSET[itemId] || 0;
    const minFloorY = FLOOR_MIN_Y - bottomOffset;
    const maxFloorY = 432 - bottomOffset;

    const getStoredPreviewPos = (pid, defX, defY) => {
      const p = appStorage ? appStorage.getItemPosition(pid) : { x: defX, y: defY };
      return clampPreviewItemPosition(pid, p.x, p.y);
    };

    if (GROUND_ONLY_PETS.has(itemId)) {
      if (placedSet.has("beige_cushion")) {
        const cp = getStoredPreviewPos("beige_cushion", 190, 355);
        const cy = itemId === "living_room_dog" ? cp.y - 10 : cp.y - 2;
        const cx = Math.max(cp.x - 22, Math.min(cp.x + 22, clamped.x));
        if (cp.y >= 168 && Math.hypot(clamped.x - cx, clamped.y - cy) <= 36) {
          return { x: cx, y: cy };
        }
      }
      return clampPreviewItemPosition(
        itemId,
        clamped.x,
        Math.max(minFloorY, Math.min(maxFloorY, clamped.y))
      );
    }

    if (itemId === "cockatiel_bird") {
      const perches = [];
      if (placedSet.has("wall_wood_branch")) {
        const bp = getStoredPreviewPos("wall_wood_branch", 306, 88);
        perches.push({
          x: Math.max(bp.x - 14, Math.min(bp.x + 8, clamped.x)),
          y: bp.y - 5.5,
          exactY: true
        });
      }
      if (placedSet.has("wooden_bird_perch")) {
        const pp = getStoredPreviewPos("wooden_bird_perch", 285, 274);
        perches.push({
          x: Math.max(pp.x - 14, Math.min(pp.x + 8, clamped.x)),
          y: pp.y - 53.5,
          exactY: true
        });
      }
      for (const bar of WINDOW_HORIZONTAL_BARS) {
        perches.push({
          x: Math.max(bar.walkMinX, Math.min(bar.walkMaxX, clamped.x)),
          y: bar.y - bottomOffset,
          exactY: false
        });
      }
      let best = perches[0];
      let bestDist = Infinity;
      for (const p of perches) {
        const d = Math.hypot(p.x - clamped.x, p.y - clamped.y);
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      }
      const safeX = clampPreviewItemPosition(itemId, best.x, best.y).x;
      return {
        x: safeX,
        y: best.exactY ? best.y : clampPreviewItemPosition(itemId, safeX, best.y).y
      };
    }

    // CLIMBER_PETS (고양이 2종, 햄스터)
    const candidates = [];
    for (const bar of WINDOW_HORIZONTAL_BARS) {
      candidates.push({
        x: Math.max(bar.walkMinX, Math.min(bar.walkMaxX, clamped.x)),
        y: bar.y - bottomOffset
      });
    }
    if ((itemId === "window_cat" || itemId === "tuxedo_cat") && placedSet.has("mini_cat_tower")) {
      const tp = getStoredPreviewPos("mini_cat_tower", 64, 318);
      candidates.push({ x: tp.x - 9, y: tp.y - 94 });
      candidates.push({ x: tp.x + 14, y: tp.y - 62 });
      candidates.push({ x: tp.x - 16, y: tp.y - 58 });
    }
    if (itemId === "hamster_friend" && placedSet.has("hamster_wheel")) {
      const wp = getStoredPreviewPos("hamster_wheel", 118, WINDOW_SILL_Y);
      if (Math.hypot(clamped.x - wp.x, clamped.y - (wp.y - 13)) <= 32) {
        candidates.push({ x: wp.x, y: wp.y - 13 });
      }
    }
    if (placedSet.has("beige_cushion")) {
      const cp = getStoredPreviewPos("beige_cushion", 190, 355);
      if (cp.y >= 168) {
        candidates.push({
          x: Math.max(cp.x - 22, Math.min(cp.x + 22, clamped.x)),
          y: cp.y - 2
        });
      }
    }
    candidates.push({
      x: clamped.x,
      y: Math.max(minFloorY, Math.min(maxFloorY, clamped.y))
    });

    let best = candidates[0];
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = Math.hypot(c.x - clamped.x, c.y - clamped.y);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return clampPreviewItemPosition(itemId, best.x, best.y);
  }

  function buildSharedLivingRoomMarkup(placedItemIds = [], idPrefix = "") {
    const set = new Set(placedItemIds);

    const branchPreviewPos = set.has("wall_wood_branch")
      ? clampPreviewItemPosition(
          "wall_wood_branch",
          appStorage ? appStorage.getItemPosition("wall_wood_branch").x : 306,
          appStorage ? appStorage.getItemPosition("wall_wood_branch").y : 88
        )
      : null;
    const perchPreviewPos = set.has("wooden_bird_perch")
      ? clampPreviewItemPosition(
          "wooden_bird_perch",
          appStorage ? appStorage.getItemPosition("wooden_bird_perch").x : 285,
          appStorage ? appStorage.getItemPosition("wooden_bird_perch").y : 274
        )
      : null;

    const propsRendered = ALL_PROP_IDS
      .map((id) => {
        if (!set.has(id)) return "";
        const rawPos = appStorage ? appStorage.getItemPosition(id) : { x: 190, y: 290 };
        let pos = clampPreviewItemPosition(id, rawPos.x, rawPos.y);

        // 미니 프리뷰 & 폴라로이드에서도 왕관앵무가 나뭇가지/횃대 윗면 선에 발끝이 딱 맞닿아 앉도록 정렬
        if (id === "cockatiel_bird") {
          if (
            branchPreviewPos &&
            (Math.hypot(rawPos.x - branchPreviewPos.x, rawPos.y - branchPreviewPos.y) <= 65 ||
              (Math.abs(rawPos.x - 158) <= 2 && Math.abs(rawPos.y - 122) <= 2))
          ) {
            const clampedX = clampPreviewItemPosition(
              "cockatiel_bird",
              branchPreviewPos.x - 3,
              branchPreviewPos.y
            ).x;
            pos = { x: clampedX, y: branchPreviewPos.y - 5.5 };
          } else if (
            perchPreviewPos &&
            Math.hypot(rawPos.x - perchPreviewPos.x, rawPos.y - (perchPreviewPos.y - 52)) <= 45
          ) {
            const clampedX = clampPreviewItemPosition(
              "cockatiel_bird",
              perchPreviewPos.x - 3,
              perchPreviewPos.y
            ).x;
            pos = { x: clampedX, y: perchPreviewPos.y - 53.5 };
          } else {
            pos = resolvePreviewLandingPosition(id, pos.x, pos.y, set);
          }
        } else if (ALL_LIVING_PETS.has(id)) {
          pos = resolvePreviewLandingPosition(id, pos.x, pos.y, set);
        }

        const isLit = appStorage ? appStorage.getLampLit(id) : true;
        let markup = getItemLocalSVGMarkup(id, false, isLit);
        if (idPrefix) {
          markup = markup
            .replace(/url\(#lampNaturalGlowGrad\)/g, `url(#${idPrefix}lampNaturalGlowGrad)`)
            .replace(/url\(#lampCoreGlowGrad\)/g, `url(#${idPrefix}lampCoreGlowGrad)`);
        }
        return `<g transform="translate(${pos.x}, ${pos.y})">${markup}</g>`;
      })
      .join("");

    const rawDogPos = appStorage
      ? appStorage.getItemPosition("living_room_dog")
      : { x: 196, y: 296 };
    const dogPos = resolvePreviewLandingPosition("living_room_dog", rawDogPos.x, rawDogPos.y, set);

    const dogRendered = set.has("living_room_dog")
      ? `
      <g transform="translate(${dogPos.x}, ${dogPos.y})">
        <line x1="-12" y1="4" x2="-14" y2="17" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
        <line x1="-6" y1="4" x2="-4" y2="17" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
        <line x1="10" y1="4" x2="8" y2="17" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
        <line x1="16" y1="4" x2="18" y2="17" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
        <path d="M-19 -6 C-27 -12, -29 -19, -23 -21" fill="none" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
        <path d="M-20 -4 C-21 -14, -8 -16, 8 -14 C18 -13, 22 -5, 20 3 C18 8, -17 8, -20 -4 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.75" stroke-linejoin="round" />
        <g transform="translate(18, -14)">
          <circle cx="2" cy="-2" r="12.5" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.75" />
          <path d="M-5 -10 C-11 -9, -13 1, -7 4 C-3 5, -2 -3, -4 -8" fill="#EAE0D0" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
          <circle cx="7" cy="-4" r="1.7" fill="#1F1E1D" />
          <ellipse cx="14" cy="-1.5" rx="2.5" ry="1.9" fill="#1F1E1D" />
          <path d="M10 2.5 Q12 5 14 2.5" fill="none" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round" />
          <ellipse cx="5" cy="1" rx="2.8" ry="1.6" fill="#F2B8A2" opacity="0.7" />
        </g>
        <path d="M10 -12 C12 -6, 16 -4, 19 -5" fill="none" stroke="#D97736" stroke-width="2" stroke-linecap="round" />
        <circle cx="16" cy="-4" r="2.2" fill="#F4C065" stroke="#1F1E1D" stroke-width="1.1" />
      </g>`
      : "";

    // 2~3번째 중복 배치 인스턴스들도 미니 프리뷰 및 그림일기 폴라로이드에 동일하게 반영
    let extraInstancesRendered = "";
    if (appStorage && typeof appStorage.getPlacedInstances === "function") {
      const seenCount = {};
      const extraChunks = [];
      appStorage.getPlacedInstances().forEach((inst) => {
        const cnt = seenCount[inst.itemId] || 0;
        seenCount[inst.itemId] = cnt + 1;
        if (cnt < 1) return;

        let pos = clampPreviewItemPosition(inst.itemId, inst.x, inst.y);
        if (ALL_LIVING_PETS.has(inst.itemId)) {
          pos = resolvePreviewLandingPosition(inst.itemId, pos.x, pos.y, set);
        }
        const isPet = ALL_LIVING_PETS.has(inst.itemId);
        const flipTransform = isPet && inst.flipX ? ' transform="scale(-1, 1)"' : "";

        let markup = "";
        if (inst.itemId === "living_room_dog") {
          markup = `
            <line x1="-12" y1="4" x2="-14" y2="17" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
            <line x1="-6" y1="4" x2="-4" y2="17" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
            <line x1="10" y1="4" x2="8" y2="17" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
            <line x1="16" y1="4" x2="18" y2="17" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
            <path d="M-19 -6 C-27 -12, -29 -19, -23 -21" fill="none" stroke="#1F1E1D" stroke-width="1.8" stroke-linecap="round" />
            <path d="M-20 -4 C-21 -14, -8 -16, 8 -14 C18 -13, 22 -5, 20 3 C18 8, -17 8, -20 -4 Z" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.75" stroke-linejoin="round" />
            <g transform="translate(18, -14)">
              <circle cx="2" cy="-2" r="12.5" fill="#FEF9F1" stroke="#1F1E1D" stroke-width="1.75" />
              <path d="M-5 -10 C-11 -9, -13 1, -7 4 C-3 5, -2 -3, -4 -8" fill="#EAE0D0" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="round" />
              <circle cx="7" cy="-4" r="1.7" fill="#1F1E1D" />
              <ellipse cx="14" cy="-1.5" rx="2.5" ry="1.9" fill="#1F1E1D" />
              <path d="M10 2.5 Q12 5 14 2.5" fill="none" stroke="#1F1E1D" stroke-width="1.4" stroke-linecap="round" />
              <ellipse cx="5" cy="1" rx="2.8" ry="1.6" fill="#F2B8A2" opacity="0.7" />
            </g>
            <path d="M10 -12 C12 -6, 16 -4, 19 -5" fill="none" stroke="#D97736" stroke-width="2" stroke-linecap="round" />
            <circle cx="16" cy="-4" r="2.2" fill="#F4C065" stroke="#1F1E1D" stroke-width="1.1" />
          `;
        } else {
          const isLit = appStorage.getLampLit(inst.itemId);
          markup = getItemLocalSVGMarkup(inst.itemId, false, isLit);
          if (idPrefix) {
            markup = markup
              .replace(/url\(#lampNaturalGlowGrad\)/g, `url(#${idPrefix}lampNaturalGlowGrad)`)
              .replace(/url\(#lampCoreGlowGrad\)/g, `url(#${idPrefix}lampCoreGlowGrad)`);
          }
        }
        extraChunks.push(`<g transform="translate(${pos.x}, ${pos.y})"><g${flipTransform}>${markup}</g></g>`);
      });
      extraInstancesRendered = extraChunks.join("");
    }

    const activeViewId = getActiveWindowViewFromPlaced(placedItemIds);
    return `
      <defs>
        ${getSharedLightingDefs(idPrefix)}
        <clipPath id="${idPrefix}windowGlassClip">
          <rect x="122" y="${WINDOW_TOP_Y}" width="136" height="136" />
        </clipPath>
      </defs>
      <g clip-path="url(#${idPrefix}windowGlassClip)">
        ${activeViewId ? getWindowViewSVGMarkup(activeViewId, idPrefix, true) : ""}
      </g>
      <g>
        <rect x="122" y="${WINDOW_TOP_Y}" width="136" height="136" fill="none" stroke="#1F1E1D" stroke-width="1.65" stroke-linejoin="miter" />
        <line x1="190" y1="${WINDOW_TOP_Y}" x2="190" y2="${WINDOW_SILL_Y}" stroke="#1F1E1D" stroke-width="1.5" />
        <line x1="122" y1="${WINDOW_MID_Y}" x2="258" y2="${WINDOW_MID_Y}" stroke="#1F1E1D" stroke-width="1.5" />
        <line x1="24" y1="${WINDOW_SILL_Y}" x2="356" y2="${WINDOW_SILL_Y}" stroke="#1F1E1D" stroke-width="1.65" stroke-linecap="round" />
      </g>
      ${getWindowSunbeamOverlayMarkup(activeViewId, idPrefix, true)}
      ${propsRendered}
      ${dogRendered}
      ${extraInstancesRendered}
    `;
  }

  function renderShopMiniPreviewSVG(placedItemIds = []) {
    // 하단 더미 버튼 제거 후, 거실 전체가 세로 정중앙에 안정적인 액자 구도로 담기도록 viewBox Y 범위(-92 ~ 438, 높이 530)로 균형 보정
    const previewMinY = -92;
    const previewH = 530;
    return `
      <svg viewBox="${VIEWBOX_MIN_X} ${previewMinY} ${VIEWBOX_W} ${previewH}" fill="none" xmlns="http://www.w3.org/2000/svg" class="mini-room-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <clipPath id="shopMiniRoomClip">
            <rect x="0" y="${previewMinY}" width="${VIEWBOX_W}" height="${previewH}" />
          </clipPath>
        </defs>
        <g clip-path="url(#shopMiniRoomClip)">
          ${buildSharedLivingRoomMarkup(placedItemIds, "shopPreview_")}
        </g>
      </svg>
    `;
  }

  function renderPolaroidSceneSVG(placedItemIds = []) {
    // 그림일기 폴라로이드 프레임(및 저장/공유 캡처): 상단 앵무새·나뭇가지가 윗 테두리에 닿지 않고
    // 거실 전체가 프레임 정중앙에 여유 있게 담기도록 상단 여백 확보(viewBox Y: -92 ~ 448, 높이 540)
    const polaroidMinY = -92;
    const polaroidH = 540;
    return `
      <svg id="polaroid-scene-svg" viewBox="${VIEWBOX_MIN_X} ${polaroidMinY} ${VIEWBOX_W} ${polaroidH}" fill="none" xmlns="http://www.w3.org/2000/svg" class="polaroid-scene-svg" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="${polaroidMinY}" width="${VIEWBOX_W}" height="${polaroidH}" fill="#FEF9F1" />
        ${buildSharedLivingRoomMarkup(placedItemIds, "polaroid_")}
      </svg>
    `;
  }

  PetFocus.LivingRoomScene = LivingRoomScene;
  PetFocus.renderShopMiniPreviewSVG = renderShopMiniPreviewSVG;
  PetFocus.renderPolaroidSceneSVG = renderPolaroidSceneSVG;
})(window);
