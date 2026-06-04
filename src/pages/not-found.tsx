import { Button, Text } from "@hyperbridge/ui"
import { Link } from "react-router"
import { BackgroundAnimation } from "@/components/background-animation"
import { FloatingImage } from "@/components/common/FloatingImage"

export function NotFoundPage() {
  return (
    <div className="404-page min-h-(--content-height) flex items-center md:h-auto">
      <BackgroundAnimation />

      <div className="bg-background mx-auto flex h-full max-w-[450px] flex-col justify-between py-12">
        <div className="mx-auto flex max-w-[303px] flex-col items-center justify-center">
          <Text variant="h5" className="text-center !font-medium" asChild>
            <h1>Page not found</h1>
          </Text>

          <Text
            variant="body2"
            className="mt-4 text-center !font-normal text-[var(--color-brand-black-100)]"
          >
            It looks like the page you're looking for does not exist or has been
            moved.
          </Text>

          <Link to="/">
            <Button className="mt-10 min-w-[240px]">Back home</Button>
          </Link>
        </div>

        <section className="relative mx-auto mt-10 flex w-[calc(100%-18px)] justify-center md:w-full md:![--float-scale:9.625rem] [&]:[--float-scale:6.6875rem]">
          <FloatingImage
            src={"/assets/illustrations/star.webp"}
            alt="Star illustration"
            className="size-(--float-scale) -mr-[6%]"
            delay={0}
            duration={7}
            yRange={[-15, 10]}
            xRange={[-3, 8]}
            rotateRange={[-12, 15]}
            rotationDuration={10}
          />

          <FloatingImage
            src={"/assets/illustrations/clover.webp"}
            alt="Clover illustration"
            className="size-(--float-scale) -mx-[8%]"
            delay={1.5}
            duration={8.5}
            yRange={[-18, 12]}
            xRange={[-6, 4]}
            rotateRange={[-8, 18]}
            rotationDuration={12}
          />

          <FloatingImage
            src={"/assets/illustrations/triangle.webp"}
            alt="Triangle illustration"
            className="size-(--float-scale) -mx-[8%]"
            delay={3}
            duration={6.5}
            yRange={[-12, 8]}
            xRange={[-4, 6]}
            rotateRange={[-20, 10]}
            rotationDuration={9}
          />

          <FloatingImage
            src={"/assets/illustrations/diamond.webp"}
            alt="Diamond illustration"
            className="size-(--float-scale) -ml-[10%] scale-[1.08]"
            duration={6.5}
            yRange={[-20, 15]}
            xRange={[-7, 3]}
            rotateRange={[-6, 22]}
            rotationDuration={14}
          />
        </section>
      </div>
    </div>
  )
}
