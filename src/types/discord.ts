// Discord Gateway 事件类型定义

export interface GatewayPayload {
  op: number;
  d?: any;
  s?: number;
  t?: string;
}

export interface GatewayMessage {
  id: string;
  channel_id: string;
  guild_id?: string;
  author: GatewayUser;
  member?: GatewayMember;
  content: string;
  timestamp: string;
  edited_timestamp?: string;
  tts: boolean;
  mention_everyone: boolean;
  mentions: GatewayUser[];
  mention_roles: string[];
  attachments: GatewayAttachment[];
  embeds: GatewayEmbed[];
  reactions?: GatewayReaction[];
  nonce?: string | number;
  pinned: boolean;
  webhook_id?: string;
  type: number;
  activity?: GatewayMessageActivity;
  application?: GatewayApplication;
  application_id?: string;
  message_reference?: GatewayMessageReference;
  flags?: number;
  referenced_message?: GatewayMessage;
  interaction?: GatewayMessageInteraction;
  thread?: GatewayChannel;
  components?: GatewayComponent[];
  sticker_items?: GatewaySticker[];
  position?: number;
}

export interface GatewayUser {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string;
  avatar?: string;
  bot?: boolean;
  system?: boolean;
  mfa_enabled?: boolean;
  banner?: string;
  accent_color?: number;
  locale?: string;
  verified?: boolean;
  email?: string;
  flags?: number;
  premium_type?: number;
  public_flags?: number;
  avatar_decoration?: string;
}

export interface GatewayMember {
  user?: GatewayUser;
  nick?: string;
  avatar?: string;
  roles: string[];
  joined_at: string;
  premium_since?: string;
  deaf: boolean;
  mute: boolean;
  flags: number;
  pending?: boolean;
  permissions?: string;
  communication_disabled_until?: string;
}

export interface GatewayAttachment {
  id: string;
  filename: string;
  description?: string;
  content_type?: string;
  size: number;
  url: string;
  proxy_url: string;
  height?: number;
  width?: number;
  ephemeral?: boolean;
}

export interface GatewayEmbed {
  title?: string;
  type?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: GatewayEmbedFooter;
  image?: GatewayEmbedImage;
  thumbnail?: GatewayEmbedThumbnail;
  video?: GatewayEmbedVideo;
  provider?: GatewayEmbedProvider;
  author?: GatewayEmbedAuthor;
  fields?: GatewayEmbedField[];
}

export interface GatewayEmbedFooter {
  text: string;
  icon_url?: string;
  proxy_icon_url?: string;
}

export interface GatewayEmbedImage {
  url: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface GatewayEmbedThumbnail {
  url: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface GatewayEmbedVideo {
  url?: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface GatewayEmbedProvider {
  name?: string;
  url?: string;
}

export interface GatewayEmbedAuthor {
  name?: string;
  url?: string;
  icon_url?: string;
  proxy_icon_url?: string;
}

export interface GatewayEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface GatewayReaction {
  count: number;
  me: boolean;
  emoji: GatewayEmoji;
}

export interface GatewayEmoji {
  id?: string;
  name?: string;
  roles?: string[];
  user?: GatewayUser;
  require_colons?: boolean;
  managed?: boolean;
  animated?: boolean;
  available?: boolean;
}

export interface GatewayMessageActivity {
  type: number;
  party_id?: string;
}

export interface GatewayApplication {
  id: string;
  name: string;
  icon?: string;
  description: string;
  rpc_origins?: string[];
  bot_public: boolean;
  bot_require_code_grant: boolean;
  terms_of_service_url?: string;
  privacy_policy_url?: string;
  owner?: GatewayUser;
  summary: string;
  verify_key: string;
  team?: GatewayTeam;
  guild_id?: string;
  primary_sku_id?: string;
  slug?: string;
  cover_image?: string;
  flags?: number;
}

export interface GatewayTeam {
  icon?: string;
  id: string;
  members: GatewayTeamMember[];
  name: string;
  owner_user_id: string;
}

export interface GatewayTeamMember {
  membership_state: number;
  permissions: string[];
  team_id: string;
  user: GatewayUser;
}

export interface GatewayMessageReference {
  message_id?: string;
  channel_id?: string;
  guild_id?: string;
  fail_if_not_exists?: boolean;
}

export interface GatewayMessageInteraction {
  id: string;
  type: number;
  name: string;
  user: GatewayUser;
  member?: GatewayMember;
}

export interface GatewayChannel {
  id: string;
  type: number;
  guild_id?: string;
  position?: number;
  permission_overwrites?: GatewayOverwrite[];
  name?: string;
  topic?: string;
  nsfw?: boolean;
  last_message_id?: string;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  recipients?: GatewayUser[];
  icon?: string;
  owner_id?: string;
  application_id?: string;
  parent_id?: string;
  last_pin_timestamp?: string;
  rtc_region?: string;
  video_quality_mode?: number;
  message_count?: number;
  member_count?: number;
  thread_metadata?: GatewayThreadMetadata;
  member?: GatewayThreadMember;
  default_auto_archive_duration?: number;
  permissions?: string;
  flags?: number;
  total_message_sent?: number;
  available_tags?: GatewayForumTag[];
  applied_tags?: string[];
  default_reaction_emoji?: GatewayDefaultReaction;
  default_thread_rate_limit_per_user?: number;
  default_sort_order?: number;
  default_forum_layout?: number;
}

export interface GatewayOverwrite {
  id: string;
  type: number;
  allow: string;
  deny: string;
}

export interface GatewayThreadMetadata {
  archived: boolean;
  auto_archive_duration: number;
  archive_timestamp: string;
  locked: boolean;
  invitable?: boolean;
  create_timestamp?: string;
}

export interface GatewayThreadMember {
  id?: string;
  user_id?: string;
  join_timestamp: string;
  flags: number;
  member?: GatewayMember;
}

export interface GatewayForumTag {
  id: string;
  name: string;
  moderated: boolean;
  emoji_id?: string;
  emoji_name?: string;
}

export interface GatewayDefaultReaction {
  emoji_id?: string;
  emoji_name?: string;
}

export interface GatewayComponent {
  type: number;
  custom_id?: string;
  disabled?: boolean;
  style?: number;
  label?: string;
  emoji?: GatewayEmoji;
  url?: string;
  options?: GatewaySelectOption[];
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  components?: GatewayComponent[];
}

export interface GatewaySelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: GatewayEmoji;
  default?: boolean;
}

export interface GatewaySticker {
  id: string;
  pack_id?: string;
  name: string;
  description?: string;
  tags: string;
  asset?: string;
  type: number;
  format_type: number;
  available?: boolean;
  guild_id?: string;
  user?: GatewayUser;
  sort_value?: number;
}

// Gateway Opcodes
export enum GatewayOpcode {
  Dispatch = 0,
  Heartbeat = 1,
  Identify = 2,
  PresenceUpdate = 3,
  VoiceStateUpdate = 4,
  Resume = 6,
  Reconnect = 7,
  RequestGuildMembers = 8,
  InvalidSession = 9,
  Hello = 10,
  HeartbeatACK = 11,
}

// Gateway Close Codes
export enum GatewayCloseCode {
  UnknownError = 4000,
  UnknownOpcode = 4001,
  DecodeError = 4002,
  NotAuthenticated = 4003,
  AuthenticationFailed = 4004,
  AlreadyAuthenticated = 4005,
  InvalidSeq = 4007,
  RateLimited = 4008,
  SessionTimedOut = 4009,
  InvalidShard = 4010,
  ShardingRequired = 4011,
  InvalidAPIVersion = 4012,
  InvalidIntents = 4013,
  DisallowedIntents = 4014,
}

// Gateway Intents
export enum GatewayIntent {
  Guilds = 1 << 0,
  GuildMembers = 1 << 1,
  GuildBans = 1 << 2,
  GuildEmojisAndStickers = 1 << 3,
  GuildIntegrations = 1 << 4,
  GuildWebhooks = 1 << 5,
  GuildInvites = 1 << 6,
  GuildVoiceStates = 1 << 7,
  GuildPresences = 1 << 8,
  GuildMessages = 1 << 9,
  GuildMessageReactions = 1 << 10,
  GuildMessageTyping = 1 << 11,
  DirectMessages = 1 << 12,
  DirectMessageReactions = 1 << 13,
  DirectMessageTyping = 1 << 14,
  MessageContent = 1 << 15,
  GuildScheduledEvents = 1 << 16,
  AutoModerationConfiguration = 1 << 20,
  AutoModerationExecution = 1 << 21,
}

// Discord API Response Types
export interface DiscordInteraction {
  id: string;
  application_id: string;
  type: number;
  data?: DiscordInteractionData;
  guild_id?: string;
  channel_id?: string;
  member?: GatewayMember;
  user?: GatewayUser;
  token: string;
  version: number;
  message?: GatewayMessage;
  app_permissions?: string;
  locale?: string;
  guild_locale?: string;
}

export interface DiscordInteractionData {
  id?: string;
  name?: string;
  type?: number;
  resolved?: DiscordResolvedData;
  options?: DiscordInteractionDataOption[];
  custom_id?: string;
  component_type?: number;
  values?: string[];
  target_id?: string;
}

export interface DiscordResolvedData {
  users?: Record<string, GatewayUser>;
  members?: Record<string, GatewayMember>;
  roles?: Record<string, GatewayRole>;
  channels?: Record<string, GatewayChannel>;
  messages?: Record<string, GatewayMessage>;
}

export interface DiscordInteractionDataOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: DiscordInteractionDataOption[];
  focused?: boolean;
}

export interface GatewayRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  icon?: string;
  unicode_emoji?: string;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  tags?: GatewayRoleTags;
  flags: number;
}

export interface GatewayRoleTags {
  bot_id?: string;
  integration_id?: string;
  premium_subscriber?: null;
  subscription_listing_id?: string;
  available_for_purchase?: null;
  guild_connections?: null;
}
