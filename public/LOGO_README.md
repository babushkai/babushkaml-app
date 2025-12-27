# Custom Logo Instructions

## Adding Your Custom Logo

1. **Replace `logo.png`** in the `frontend/public/` directory with your custom logo image
   - Recommended size: 512x512px (square)
   - Format: PNG with transparency (supports SVG too)
   - File name: `logo.png`

2. **The logo will automatically appear** in:
   - Sidebar (when collapsed and expanded)
   - Login page
   - Anywhere the Logo component is used

## Logo Variants

The Logo component supports different variants:

- `variant="icon"` - Just the logo image (no text)
- `variant="full"` - Logo with text (BabushkaML + tagline)

## Sizes

- `size="sm"` - 24x24px (w-6 h-6)
- `size="md"` - 32x32px (w-8 h-8) 
- `size="lg"` - 48x48px (w-12 h-12)
- `size="xl" - 64x64px (w-16 h-16)

## Fallback

If `logo.png` is not found, a gradient icon with a Babushka (matryoshka doll) SVG will be displayed automatically.

## Example Usage

```tsx
import { Logo } from '@/components/ui/Logo'

// Icon only
<Logo size="lg" variant="icon" />

// Full logo with text
<Logo size="lg" showText={true} variant="full" />
```
