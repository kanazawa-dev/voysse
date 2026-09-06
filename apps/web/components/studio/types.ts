export type StudioAgent = {
  id: string; name: string; description: string; instructions: string;
  model: string; provider: string; is_active: boolean; updated_at: string;
  widget_enabled: boolean; widget_greeting: string; widget_color: string; widget_position: string;
};
export type ChannelKind = 'whatsapp' | 'whatsapp-cloud' | 'instagram' | 'messenger';
export type StudioChannel = {
  kind: ChannelKind; id: string | null; agent_id: string | null;
  status: string; is_enabled: boolean; updated_at: string | null;
};
export type StudioGraph = {
  client: { id: string; name: string; is_active: boolean };
  agents: StudioAgent[]; channels: StudioChannel[];
};
export const channelNames: Record<ChannelKind, string> = {
  whatsapp: 'WhatsApp QR', 'whatsapp-cloud': 'WhatsApp Cloud', instagram: 'Instagram', messenger: 'Messenger',
};
export const channelSetupPath = (clientId: string, kind: ChannelKind) =>
  `/clients/${clientId}/channels/${kind === 'instagram' || kind === 'messenger' ? `social/${kind}` : kind}`;
