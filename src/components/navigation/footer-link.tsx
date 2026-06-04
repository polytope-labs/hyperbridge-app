import { Link } from "react-router"

export const FooterLink = ({
  href,
  label,
  target,
}: {
  href: string
  label: string
  target?: "_blank" | "_self"
}) => {
  return (
    <Link
      to={href}
      className="footer-link text-caption text-brand-black-100 font-medium tracking-normal transition-colors duration-200 hover:text-white"
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
    >
      {label}
    </Link>
  )
}
