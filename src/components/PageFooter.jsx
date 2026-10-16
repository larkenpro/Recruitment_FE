import { SPACE, TEXT } from '../theme'

// Sits under every page, inside the scrolling area: room to scroll the last table or graph clear of
// the window's edge, so its dropdowns and buttons aren't hard against the bottom.
export default function PageFooter() {
  return (
    <footer
      style={{
        ...TEXT.caption,
        minHeight: 160,
        marginTop: SPACE.xl,
        paddingTop: SPACE.lg,
        borderTop: '1px solid #e5e7eb',
        textAlign: 'center',
      }}
    >
      Recruit · J&amp;J Sourcing
    </footer>
  )
}
