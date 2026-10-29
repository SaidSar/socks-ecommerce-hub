/** Superficie blanca con borde fino y rounded-lg. Sin sombra (DESIGN_ADMIN.md §2). */
export default function Card({ as: Tag = 'section', className = '', children, ...props }) {
  return (
    <Tag className={`bg-paper border border-line rounded-lg ${className}`} {...props}>
      {children}
    </Tag>
  )
}
