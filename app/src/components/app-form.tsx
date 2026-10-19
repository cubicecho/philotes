import { ColorField } from '@/components/ui/color-picker-field';
import { ComboboxField } from '@/components/ui/combobox-field';
import { DateTimeField } from '@/components/ui/date-time-field';
import { createAppForm } from '@/components/ui/form';

/**
 * The app's single form hook: cubeui's native fields, with the heavy ones — the calendar, the
 * colour picker and the combobox — joined to them once, here, so every form reaches all of them
 * on `field.*`.
 */
export const { useAppForm, withForm } = createAppForm({ DateTimeField, ColorField, ComboboxField });
