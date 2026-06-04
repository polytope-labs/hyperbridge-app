import {
  HBDrawer,
  HBDrawerClose,
  HBDrawerContent,
  HBDrawerHeader,
  HBDrawerTitle,
  HBDrawerTrigger,
  Text,
} from "@hyperbridge/ui"
import { ChevronBottomDown, XIcon } from "@hyperbridge/ui/icons"
import { Link } from "react-router"
import { footerLinks, mobileLinks, socialLinks } from "@/config/navigation"
import { FooterLink } from "./footer-link"

export const Footer = () => {
  return (
    <footer className="min-h-12 p-4">
      <div className="footer-container mx-auto flex items-center justify-between *:flex-1">
        {socialLinks.length > 0 && (
          <ul className="socials-links hidden items-center gap-5 md:flex">
            {socialLinks.map((link) => (
              <li key={link.label}>
                <FooterLink
                  href={link.href}
                  label={link.label}
                  target={link.isExternal ? "_blank" : "_self"}
                />
              </li>
            ))}
          </ul>
        )}

        {footerLinks.length > 0 && (
          <ul className="footer-links hidden items-center justify-end gap-5 md:flex">
            {footerLinks.map((link) => (
              <li key={link.label}>
                <FooterLink
                  href={link.href}
                  label={link.label}
                  target={link.isExternal ? "_blank" : "_self"}
                />
              </li>
            ))}
          </ul>
        )}

        {mobileLinks.length > 0 && (
          <ul className="footer-links flex items-center gap-2 md:hidden">
            {mobileLinks.map((link) => (
              <li key={link.label}>
                <HBDrawer>
                  <HBDrawerTrigger>
                    <span className="text-brand-black-100 flex cursor-pointer items-center gap-1 transition-colors duration-200 hover:text-white">
                      <Text variant="caption" className="font-medium">
                        {link.label}
                      </Text>
                      <ChevronBottomDown className="size-3" />
                    </span>
                  </HBDrawerTrigger>
                  <HBDrawerContent className="bg-brand-black-550">
                    <HBDrawerHeader>
                      <HBDrawerTitle>
                        <Text variant="title" className="font-medium">
                          {link.label}
                        </Text>
                      </HBDrawerTitle>
                      <HBDrawerClose className="flex size-8 items-center justify-center">
                        <XIcon className="size-4" />
                      </HBDrawerClose>
                    </HBDrawerHeader>
                    <ul className="space-y-8 py-4">
                      {link.sublinks.length > 0 &&
                        link.sublinks.map((sublink) => {
                          return (
                            <li key={sublink.label}>
                              <Link
                                to={sublink.href}
                                className="text-brand-black-100 cursor-pointer text-base font-medium transition-colors duration-200 hover:text-white"
                                target={sublink.isExternal ? "_blank" : "_self"}
                              >
                                {sublink.label}
                              </Link>
                            </li>
                          )
                        })}
                    </ul>
                  </HBDrawerContent>
                </HBDrawer>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  )
}
