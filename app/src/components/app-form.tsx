import { ColorField } from '@/components/ui/color-picker-field';
import { DateTimeField } from '@/components/ui/date-time-field';
import { createAppForm } from '@/components/ui/form';

/**
 * The app's single form hook: cubeui's native fields, with the two heavy ones —
 * the calendar and the colour picker — joined to them once, here, so every form
 * reaches all of them on `field.*`.
 */
export const { useAppForm, withForm } = createAppForm({ DateTimeField, ColorField });
