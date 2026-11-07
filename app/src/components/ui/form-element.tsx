import { View } from "react-native";
import type { FormElementProps } from "@/components/ui/form-element-base";
import { cn } from "@/lib/utils";

/**
 * The element a form renders as: a `<form>` on the web, a `View` on device. A column of fields
 * 16px apart, more than the 8px inside a field, so a label reads as its field's and not the one
 * above's; a caller's gap still wins. Laid out as a row, it needs `flex-row`.
 */
export function FormElement({ className, children }: FormElementProps) {
  return <View className={cn("flex-col gap-4", className)}>{children}</View>;
}
