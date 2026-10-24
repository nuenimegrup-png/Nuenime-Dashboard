import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type AppIconProps = {
  name: string;
  size?: number;
  color?: string;
};

export function AppIcon({ name, size = 24, color = "#FFFFFF" }: AppIconProps) {
  return <MaterialCommunityIcons name={name as IconName} size={size} color={color} />;
}
