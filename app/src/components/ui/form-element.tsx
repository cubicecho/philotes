import { View } from "react-native";
import type { FormElementProps } from "@/components/ui/form-element-base";
import { cn } from "@/lib/utils";

/** The element a form renders as: a `<form>` on the web, a `View` on device. */
export function FormElement({ className, children }: FormElementProps) {
  return <View className={cn("flex-col", className)}>{children}</View>;
}
