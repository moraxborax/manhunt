import type { DifficultyLevel } from '../types/game';

export type Locale = 'zh' | 'en';

export interface DifficultyText {
  label: string;
  shortLabel: string;
  description: string;
}

export interface Translations {
  appName: string;
  appSubtitle: string;
  langToggleLabel: string;
  reconnecting: string;
  yourName: string;
  namePlaceholder: string;
  createRoom: string;
  creatingRoom: string;
  orJoinExisting: string;
  roomCode: string;
  roomCodePlaceholder: string;
  join: string;
  scanRoomQr: string;
  enterYourNameError: string;
  enterNameAndCodeError: string;
  invalidRoomQrError: string;
  roomLabel: (code: string) => string;
  inviteFriendsTitle: string;
  inviteFriendsSubtitle: string;
  showQr: string;
  shareLink: string;
  copyCode: string;
  leaveRoom: string;
  inviteSharedToast: string;
  joinLinkCopiedToast: string;
  shareFailedToast: string;
  roomCodeCopiedToast: string;
  playersHeading: (count: number) => string;
  hostBadge: string;
  joinedBadge: string;
  youBadge: string;
  difficultyHeading: (label: string) => string;
  initialHunters: string;
  headStartSeconds: string;
  scanCooldownSeconds: string;
  proximityRadiusM: string;
  needTwoPlayers: string;
  startGame: string;
  waitingForHost: string;
  enableCompass: string;
  compassEnabledToast: string;
  hunterRole: string;
  hiderRole: string;
  stealthTooltip: string;
  stealthTitle: string;
  stealthSubtitle: string;
  backToHome: string;
  showCatchQr: string;
  scanToCatch: string;
  headStartBanner: (secondsLeft: number) => string;
  headStartEnding: string;
  huntingBanner: (hidersLeft: number) => string;
  gameOverBanner: string;
  lobbyBanner: string;
  hiderEndedMessage: string;
  hiderStayHiddenMessage: string;
  scanningButton: string;
  cooldownButton: (seconds: number) => string;
  activateRadarScan: string;
  sensingButton: string;
  senseNearbyHiders: string;
  hidersWithinRadius: (count: number, radiusM: number) => string;
  tapSensePrompt: string;
  waitingForSignal: string;
  noHiderSignal: string;
  radarBlinded: string;
  recenterMap: string;
  amapSdkModeBadge: string;
  amapTileModeBadge: string;
  catchQrModalTitle: string;
  catchQrModalSubtitle: string;
  copyCatchCodeFallback: string;
  catchCodeCopiedToast: string;
  scanCatchModalTitle: string;
  scanRoomModalTitle: string;
  scanRoomModalSubtitle: string;
  cameraUnavailableFallback: string;
  pasteCatchCodePlaceholder: string;
  pasteRoomCodePlaceholder: string;
  submitCatchCode: string;
  invalidCatchQrError: string;
  wrongRoomQrError: string;
  inviteSheetTitle: (code: string) => string;
  inviteSheetSubtitle: string;
  copyInviteLink: string;
  close: string;
  difficulties: Record<DifficultyLevel, DifficultyText>;
}

export const translations: Record<Locale, Translations> = {
  zh: {
    appName: 'MANHUNT · 猎人追捕',
    appSubtitle: '户外真人定位躲猫猫 · 高德地图版',
    langToggleLabel: 'EN',
    reconnecting: '正在重连房间…',
    yourName: '你的昵称',
    namePlaceholder: '例如：阿杰 / 猎手007',
    createRoom: '创建房间',
    creatingRoom: '处理中…',
    orJoinExisting: '或加入已有房间',
    roomCode: '房间号',
    roomCodePlaceholder: '6位房间码，如 HUNT42',
    join: '加入',
    scanRoomQr: '扫描房间二维码加入',
    enterYourNameError: '请先输入你的昵称',
    enterNameAndCodeError: '请输入昵称和房间号',
    invalidRoomQrError: '无法识别该房间二维码',
    roomLabel: (code) => `房间 ${code}`,
    inviteFriendsTitle: '邀请好友加入',
    inviteFriendsSubtitle: '分享链接至微信/浏览器，或让面对面的好友直接扫描二维码加入。',
    showQr: '房间二维码',
    shareLink: '分享邀请链接',
    copyCode: '复制房间号',
    leaveRoom: '退出房间',
    inviteSharedToast: '已呼出系统分享',
    joinLinkCopiedToast: '邀请链接已复制到剪贴板',
    shareFailedToast: '分享失败，请手动复制链接',
    roomCodeCopiedToast: '房间号已复制',
    playersHeading: (count) => `玩家列表 (${count}人)`,
    hostBadge: '房主',
    joinedBadge: '已准备',
    youBadge: '我',
    difficultyHeading: (label) => `追踪模式：${label}`,
    initialHunters: '初始猎人数量',
    headStartSeconds: '躲藏先发时间 (秒)',
    scanCooldownSeconds: '主动扫描冷却 (秒)',
    proximityRadiusM: '距离感应半径 (米)',
    needTwoPlayers: '至少需要 2 名玩家才能开始',
    startGame: '开始追捕',
    waitingForHost: '等待房主开始游戏…',
    enableCompass: '校准电子罗盘权限',
    compassEnabledToast: '电子罗盘已启用',
    hunterRole: '猎人 HUNTER',
    hiderRole: '躲藏者 HIDER',
    stealthTooltip: '息屏伪装模式（防亮屏暴露位置）',
    stealthTitle: '息屏伪装中',
    stealthSubtitle: '点击屏幕任意位置恢复显示',
    backToHome: '返回首页',
    showCatchQr: '出示被抓二维码',
    scanToCatch: '扫码抓捕躲藏者',
    headStartBanner: (s) => `躲藏倒计时 — 剩余 ${s} 秒（猎人视野已屏蔽）`,
    headStartEnding: '躲藏阶段即将结束，猎人出动！',
    huntingBanner: (left) => `追捕进行中 — 剩余 ${left} 名躲藏者`,
    gameOverBanner: '游戏结束 — 所有躲藏者均已被捕！',
    lobbyBanner: '准备大厅',
    hiderEndedMessage: '你已被捕获，或本局追捕已结束。',
    hiderStayHiddenMessage: '保持隐蔽！如果被猎人抓到，请点击下方按钮出示你的专属被抓二维码。',
    scanningButton: '雷达扫描中 (8秒)…',
    cooldownButton: (s) => `冷却充能中 (${s}秒)`,
    activateRadarScan: '启动脉冲雷达扫描',
    sensingButton: '正在感应周围信号…',
    senseNearbyHiders: '主动感应附近躲藏者',
    hidersWithinRadius: (count, radiusM) =>
      `距离 ${radiusM} 米内有 ${count} 名躲藏者`,
    tapSensePrompt: '点击下方按钮感应附近躲藏者人数',
    waitingForSignal: '正在接收卫星定位信号…',
    noHiderSignal: '还没有收到躲藏者的定位',
    radarBlinded: '躲藏倒计时中，雷达已屏蔽',
    recenterMap: '回到我的位置',
    amapSdkModeBadge: '高德地图 JS 2.0 (GCJ-02)',
    amapTileModeBadge: '高德高清瓦片 (GCJ-02)',
    catchQrModalTitle: '被抓确认二维码',
    catchQrModalSubtitle: '被猎人当面抓获时，让猎人扫描此二维码。扫码后你将转化为猎人！',
    copyCatchCodeFallback: '复制抓捕码（无法扫码时备用）',
    catchCodeCopiedToast: '抓捕码已复制',
    scanCatchModalTitle: '扫描躲藏者二维码完成抓捕',
    scanRoomModalTitle: '扫描房间邀请二维码',
    scanRoomModalSubtitle: '将取景框对准房主手机上的房间二维码',
    cameraUnavailableFallback: '若摄像头权限受限，可在下方粘贴抓捕码：',
    pasteCatchCodePlaceholder: '粘贴 manhunt:房间码:玩家ID:密钥',
    pasteRoomCodePlaceholder: '或直接输入房间码 / 链接',
    submitCatchCode: '确认抓捕',
    invalidCatchQrError: '无效的抓捕二维码',
    wrongRoomQrError: '该二维码不属于当前房间',
    inviteSheetTitle: (code) => `加入房间 ${code}`,
    inviteSheetSubtitle: '使用手机相机、微信扫一扫或游戏内扫码器即可自动填入房间号',
    copyInviteLink: '复制加入链接',
    close: '关闭',
    difficulties: {
      0: {
        label: 'Lv0 · 全图实时定位',
        shortLabel: '全图定位',
        description: '高德地图实时显示可见玩家精确位置（适合超大场地或热身局）。',
      },
      1: {
        label: 'Lv1 · 实时罗盘雷达',
        shortLabel: '实时雷达',
        description: '电子罗盘随手机朝向实时旋转，显示 200 米内躲藏者相对方位与距离。',
      },
      2: {
        label: 'Lv2 · 脉冲雷达扫描',
        shortLabel: '脉冲雷达',
        description: '点击主动开启 8 秒雷达扫描，随后进入静默冷却，不暴露抓捕预警。',
      },
      3: {
        label: 'Lv3 · 实时距离感应',
        shortLabel: '距离感应',
        description: '不显示方向，仅实时显示感应半径内的躲藏者人数。',
      },
      4: {
        label: 'Lv4 · 极限盲盒感应',
        shortLabel: '手动感应',
        description: '最高难度：仅在点击主动感应时显示 8 秒附近人数，随后进入冷却。',
      },
    },
  },
  en: {
    appName: 'MANHUNT',
    appSubtitle: 'Real-life outdoor hide & seek · AMap Edition',
    langToggleLabel: '中文',
    reconnecting: 'Reconnecting to room…',
    yourName: 'Your Name',
    namePlaceholder: 'e.g. Alex / Hunter007',
    createRoom: 'Create Room',
    creatingRoom: 'Working…',
    orJoinExisting: 'OR JOIN EXISTING',
    roomCode: 'Room Code',
    roomCodePlaceholder: '6-char code, e.g. HUNT42',
    join: 'Join',
    scanRoomQr: 'Scan Room QR',
    enterYourNameError: 'Please enter your name',
    enterNameAndCodeError: 'Enter both your name and room code',
    invalidRoomQrError: 'Not a valid room QR code',
    roomLabel: (code) => `Room ${code}`,
    inviteFriendsTitle: 'Invite Friends',
    inviteFriendsSubtitle:
      'Share the join link or show a QR code they can scan with their phone camera.',
    showQr: 'Show QR',
    shareLink: 'Share Link',
    copyCode: 'Copy Code',
    leaveRoom: 'Leave Room',
    inviteSharedToast: 'Invite shared',
    joinLinkCopiedToast: 'Join link copied to clipboard',
    shareFailedToast: 'Could not share link',
    roomCodeCopiedToast: 'Room code copied',
    playersHeading: (count) => `Players (${count})`,
    hostBadge: 'Host',
    joinedBadge: 'Ready',
    youBadge: 'YOU',
    difficultyHeading: (label) => `Difficulty: ${label}`,
    initialHunters: 'Initial hunters',
    headStartSeconds: 'Head start (seconds)',
    scanCooldownSeconds: 'Scan cooldown (seconds)',
    proximityRadiusM: 'Proximity radius (m)',
    needTwoPlayers: 'Need at least 2 players',
    startGame: 'Start Game',
    waitingForHost: 'Waiting for host to start…',
    enableCompass: 'Enable Compass Permission',
    compassEnabledToast: 'Compass enabled',
    hunterRole: 'HUNTER',
    hiderRole: 'HIDER',
    stealthTooltip: 'Stealth / pocket mode',
    stealthTitle: 'STEALTH MODE',
    stealthSubtitle: 'Tap anywhere to wake screen',
    backToHome: 'Back to Home',
    showCatchQr: 'Show Catch QR',
    scanToCatch: 'Scan to Catch',
    headStartBanner: (s) => `HEAD START — ${s}s (hunters blinded)`,
    headStartEnding: 'HEAD START ending…',
    huntingBanner: (left) => `HUNTING — ${left} hider${left === 1 ? '' : 's'} left`,
    gameOverBanner: 'GAME OVER — all hiders caught',
    lobbyBanner: 'Lobby',
    hiderEndedMessage: 'You were caught — or the hunt ended.',
    hiderStayHiddenMessage:
      'Stay hidden! If caught by a hunter, tap below to show your Catch QR.',
    scanningButton: 'SCANNING (8s)…',
    cooldownButton: (s) => `COOLDOWN ${s}s`,
    activateRadarScan: 'ACTIVATE RADAR SCAN',
    sensingButton: 'SENSING (8s)…',
    senseNearbyHiders: 'SENSE NEARBY HIDERS',
    hidersWithinRadius: (count, radiusM) =>
      `${count} hider${count === 1 ? '' : 's'} within ${radiusM}m`,
    tapSensePrompt: 'Tap sense to check nearby hiders',
    waitingForSignal: 'Waiting for GPS signal…',
    noHiderSignal: 'No hider location received yet',
    radarBlinded: 'Head start — radar is blinded',
    recenterMap: 'Center on me',
    amapSdkModeBadge: 'AMap JS 2.0 (GCJ-02)',
    amapTileModeBadge: 'AMap Retina Tiles (GCJ-02)',
    catchQrModalTitle: 'Your Catch QR',
    catchQrModalSubtitle:
      'Show this when a hunter tags you. Scanning converts you into a hunter.',
    copyCatchCodeFallback: 'Copy catch token (fallback)',
    catchCodeCopiedToast: 'Catch token copied',
    scanCatchModalTitle: 'Scan Hider Catch QR',
    scanRoomModalTitle: 'Scan Room Invite QR',
    scanRoomModalSubtitle: "Point your camera at the host's room QR code",
    cameraUnavailableFallback: 'Or paste catch token manually:',
    pasteCatchCodePlaceholder: 'Paste manhunt:CODE:playerId:secret',
    pasteRoomCodePlaceholder: 'Or enter room code / invite link',
    submitCatchCode: 'Confirm Catch',
    invalidCatchQrError: 'Invalid catch QR code',
    wrongRoomQrError: 'QR code is from a different room',
    inviteSheetTitle: (code) => `Join Room ${code}`,
    inviteSheetSubtitle:
      'Scan with your phone camera or the in-app scanner to join immediately.',
    copyInviteLink: 'Copy Invite Link',
    close: 'Close',
    difficulties: {
      0: {
        label: 'Lv0 · Full Map',
        shortLabel: 'Full Map',
        description: 'Live AMap with every visible player marker.',
      },
      1: {
        label: 'Lv1 · Live Radar',
        shortLabel: 'Live Radar',
        description: 'Continuous compass radar rotating with your phone heading.',
      },
      2: {
        label: 'Lv2 · Manual Radar',
        shortLabel: 'Manual Radar',
        description: 'Tap to scan for 8s, followed by a silent cooldown.',
      },
      3: {
        label: 'Lv3 · Proximity Count',
        shortLabel: 'Proximity',
        description: 'Live count of hiders within the proximity radius.',
      },
      4: {
        label: 'Lv4 · Manual Sense',
        shortLabel: 'Manual Sense',
        description: 'Tap to sense nearby hider count for 8s, then cooldown.',
      },
    },
  },
};
