import { Mail, MessageSquare, Phone, Users, Video } from '@/components/app-icons';
import { Ellipsis } from '@/components/ui/icons';

/** The glyph for an interaction channel; anything unrecognised gets the ellipsis. */
export function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  switch (channel) {
    case 'call':
      return <Phone className={className} />;
    case 'text':
      return <MessageSquare className={className} />;
    case 'email':
      return <Mail className={className} />;
    case 'video':
      return <Video className={className} />;
    case 'in-person':
      return <Users className={className} />;
    default:
      return <Ellipsis className={className} />;
  }
}
