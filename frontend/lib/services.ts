import {
  DoorOpen,
  Footprints,
  Home,
  Moon,
  PawPrint,
  Sun,
  type LucideIcon,
} from "lucide-react";
import type { BookingServiceType, ServiceType } from "./types";

/**
 * The service catalog vocabulary — single source of truth for labels, icons,
 * tones and units across every surface. 'sit'/'walk_sit' entries exist only to
 * render legacy bookings.
 */

export interface ServiceMeta {
  value: ServiceType;
  label: string;
  short: string;
  blurb: string;
  icon: LucideIcon;
  unit: "walk" | "day" | "night" | "visit";
}

export const SERVICES: ServiceMeta[] = [
  {
    value: "walk",
    label: "Dog walking",
    short: "Walk",
    blurb: "Walks around the owner's area",
    icon: Footprints,
    unit: "walk",
  },
  {
    value: "daycare",
    label: "Daycare",
    short: "Daycare",
    blurb: "Daytime care at the walker's home",
    icon: Sun,
    unit: "day",
  },
  {
    value: "boarding",
    label: "Boarding",
    short: "Boarding",
    blurb: "Overnight stays at the walker's home",
    icon: Moon,
    unit: "night",
  },
  {
    value: "drop_in",
    label: "Drop-in visits",
    short: "Drop-in",
    blurb: "Quick check-ins at the owner's home",
    icon: DoorOpen,
    unit: "visit",
  },
];

export const SERVICE_META: Record<ServiceType, ServiceMeta> = Object.fromEntries(
  SERVICES.map((s) => [s.value, s])
) as Record<ServiceType, ServiceMeta>;

/** Booking-facing labels (includes legacy values for old rows). */
export const SERVICE_LABEL: Record<BookingServiceType, string> = {
  walk: "Walk",
  daycare: "Daycare",
  boarding: "Boarding",
  drop_in: "Drop-in",
  sit: "Sitting",
  walk_sit: "Walk & Sit",
};

export const SERVICE_ICON: Record<BookingServiceType, LucideIcon> = {
  walk: Footprints,
  daycare: Sun,
  boarding: Moon,
  drop_in: DoorOpen,
  sit: Home,
  walk_sit: PawPrint,
};

/** Chip tones per service — walk coral, daycare sunny coral, boarding teal, drop-in neutral. */
export const SERVICE_CHIP: Record<BookingServiceType, string> = {
  walk: "bg-accent-subtle text-link",
  daycare: "bg-primary/10 text-primary",
  boarding: "bg-trust-subtle text-trust-strong",
  drop_in: "bg-muted text-muted-foreground",
  sit: "bg-trust-subtle text-trust-strong",
  walk_sit: "bg-primary/10 text-primary",
};
