/**
 * Clerk appearance built from the Vappi design tokens (app/globals.css).
 * Clerk derives shades from these colours, so they're literal values that
 * mirror the tokens — keep them in sync if a token changes.
 */
export const clerkAppearance = {
  variables: {
    colorBackground: "#1b1b1b", // surface
    colorForeground: "#ffffff", // fg
    colorMutedForeground: "#9d9d9d", // fg-muted
    colorMuted: "#202020", // surface-hover
    colorNeutral: "#ffffff",
    colorBorder: "#252525", // border
    colorInput: "#161616", // bg
    colorInputForeground: "#ffffff",
    colorPrimary: "#fafafa", // white "Upgrade" button
    colorPrimaryForeground: "#000000",
    colorDanger: "#f06363",
    colorSuccess: "#3ecf8e",
    colorWarning: "#f5b544",
    colorRing: "rgba(157, 157, 157, 0.5)",
    colorShadow: "rgba(0, 0, 0, 0.6)",
    colorModalBackdrop: "rgba(0, 0, 0, 0.7)",
    fontFamily: "var(--font-sans)",
    borderRadius: "0.625rem", // radius-control
  },
  options: {
    socialButtonsVariant: "blockButton",
  },
  elements: {
    cardBox: "border border-border shadow-2xl",
    // Clerk leaves the popover's outer card transparent, so page content
    // (e.g. the purple Create button) showed through the profile menu.
    userButtonPopoverCard: "bg-surface! border border-border",
    // AGENTS.md §3: tap targets >= 44px on touch screens (below lg only).
    userButtonTrigger: "max-lg:min-h-11! max-lg:min-w-11! justify-center",
    formFieldInput: "max-lg:min-h-11!",
    formButtonPrimary: "max-lg:min-h-11!",
    socialButtonsBlockButton: "max-lg:min-h-11!",
    formFieldInputShowPasswordButton: "max-lg:min-h-11! max-lg:min-w-11!",
    footerActionLink: "max-lg:inline-flex! max-lg:min-h-11! max-lg:items-center!",
    // The Vappi logo is rendered above the card by our page instead.
    logoBox: "hidden",
  },
} as const;
