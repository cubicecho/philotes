import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { CalendarProps, DateMatcher, DateRange } from '@/components/ui/calendar-base';
import { ChevronLeft, ChevronRight } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Whether one matcher covers a day. Several are ORed by the caller below. */
function covers(day: Date, matcher: DateMatcher): boolean {
  if (typeof matcher === 'function') return matcher(day);
  if (matcher instanceof Date) return isSameDay(day, matcher);
  if (Array.isArray(matcher)) return matcher.some((d) => isSameDay(day, d));
  if ('from' in matcher) {
    return !isBefore(day, startOfDay(matcher.from)) && !isAfter(day, endOfDay(matcher.to));
  }
  if ('before' in matcher) return isBefore(day, startOfDay(matcher.before));
  return isAfter(day, endOfDay(matcher.after));
}

// Comparisons are between calendar days, not instants: `{ before: new Date() }`
// means "before today", and a matcher built at 14:00 must not disable this morning.
function startOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}
function endOfDay(date: Date): Date {
  const out = new Date(date);
  out.setHours(23, 59, 59, 999);
  return out;
}

function isDisabled(day: Date, disabled: CalendarProps['disabled']): boolean {
  if (!disabled) return false;
  // A bare `Date[]` is one matcher, not a list of them — `covers` handles it — so the
  // list case is only reached for a genuine array of matchers.
  if (Array.isArray(disabled) && disabled.some((m) => !(m instanceof Date))) {
    return (disabled as DateMatcher[]).some((m) => covers(day, m));
  }
  return covers(day, disabled as DateMatcher);
}

/** Where a day sits in the selection, which is what decides how it is drawn. */
function placeInRange(day: Date, range: DateRange | undefined) {
  if (!range?.from) return { selected: false, edge: false, middle: false };
  const from = range.from;
  const to = range.to;
  if (!to) return { selected: isSameDay(day, from), edge: isSameDay(day, from), middle: false };
  const edge = isSameDay(day, from) || isSameDay(day, to);
  const inside = !isBefore(day, startOfDay(from)) && !isAfter(day, endOfDay(to));
  return { selected: inside, edge, middle: inside && !edge };
}

/**
 * The next range for a press, matching react-day-picker's behaviour: the first press
 * starts a range, the second closes it, and a press before the start restarts rather
 * than producing a backwards range.
 */
function nextRange(day: Date, current: DateRange | undefined): DateRange {
  if (!current?.from || current.to) return { from: day, to: undefined };
  if (isBefore(day, current.from)) return { from: day, to: undefined };
  return { from: current.from, to: day };
}

export function Calendar(props: CalendarProps) {
  const { disabled, defaultMonth, numberOfMonths = 1, startMonth, weekStartsOn = 0, className } = props;

  const firstMonth = defaultMonth ?? (props.mode === 'range' ? props.selected?.from : props.selected) ?? new Date();
  const [month, setMonth] = useState(() => startOfMonth(firstMonth));

  const canGoBack = !startMonth || isAfter(month, startOfMonth(startMonth));
  const months = Array.from({ length: Math.max(1, numberOfMonths) }, (_, i) => addMonths(month, i));
  const weekdays = [...WEEKDAYS.slice(weekStartsOn), ...WEEKDAYS.slice(0, weekStartsOn)];

  const press = (day: Date) => {
    if (props.mode === 'range') props.onSelect(nextRange(day, props.selected));
    else props.onSelect(day);
  };

  return (
    <View className={cn('p-3', className)}>
      <View className="mb-2 flex-row items-center justify-between">
        <Pressable
          onPress={() => setMonth(addMonths(month, -1))}
          disabled={!canGoBack}
          aria-label="Previous month"
          className={cn('p-1', !canGoBack && 'opacity-30')}
        >
          <ChevronLeft className="h-4 w-4 text-foreground" />
        </Pressable>
        <Text className="text-sm font-medium text-foreground">
          {months.length === 1
            ? format(month, 'MMMM yyyy')
            : `${format(month, 'MMM yyyy')} – ${format(months[months.length - 1] ?? month, 'MMM yyyy')}`}
        </Text>
        <Pressable onPress={() => setMonth(addMonths(month, 1))} aria-label="Next month" className="p-1">
          <ChevronRight className="h-4 w-4 text-foreground" />
        </Pressable>
      </View>

      {months.map((shown) => (
        <View key={shown.toISOString()}>
          {months.length > 1 ? (
            <Text className="mb-1 text-center text-xs font-medium text-foreground">{format(shown, 'MMMM yyyy')}</Text>
          ) : null}

          <View className="flex-row">
            {weekdays.map((day) => (
              <Text key={day} className="flex-1 text-center text-xs text-foreground/60">
                {day}
              </Text>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {/* Padded out to whole weeks so every row has seven cells and the grid
                does not reflow as the month changes. */}
            {eachDayOfInterval({
              start: startOfWeek(startOfMonth(shown), { weekStartsOn }),
              end: endOfWeek(endOfMonth(shown), { weekStartsOn }),
            }).map((day) => {
              const place =
                props.mode === 'range'
                  ? placeInRange(day, props.selected)
                  : {
                      selected: props.selected ? isSameDay(day, props.selected) : false,
                      edge: props.selected ? isSameDay(day, props.selected) : false,
                      middle: false,
                    };
              const off = isDisabled(day, disabled);
              return (
                <Pressable
                  key={day.toISOString()}
                  onPress={() => press(day)}
                  disabled={off}
                  aria-disabled={off}
                  aria-selected={place.selected}
                  className={cn(
                    'h-9 items-center justify-center',
                    // A range's interior is a continuous band, so only its ends are
                    // rounded — the same shape react-day-picker draws.
                    place.middle ? 'bg-hover' : 'rounded-md',
                    place.edge && 'bg-active',
                    off && 'opacity-30',
                  )}
                  // Seven per row, and `flex-wrap` needs a width it can measure.
                  // A `w-[14.2857%]` class would round to the same place; the style
                  // keeps the arithmetic visible.
                  style={{ width: `${100 / 7}%` }}
                >
                  <Text
                    className={cn(
                      'text-sm',
                      place.edge
                        ? 'text-active-foreground'
                        : place.middle
                          ? 'text-foreground'
                          : isSameMonth(day, shown)
                            ? 'text-foreground'
                            : 'text-foreground/60',
                    )}
                  >
                    {format(day, 'd')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
