import { type ComponentPropsWithoutRef, type ReactNode } from "react"
import { ArrowRightIcon } from "@radix-ui/react-icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface BentoGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode
  className?: string
}

interface BentoCardProps extends ComponentPropsWithoutRef<"div"> {
  name: string
  className: string
  background?: ReactNode
  Icon: React.ComponentType<{ className?: string }>
  description: string
  href?: string
  cta?: string
  children?: ReactNode
}

const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[22rem] grid-cols-3 gap-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
  children,
  ...props
}: BentoCardProps) => (
  <div
    key={name}
    className={cn(
      "group relative col-span-3 overflow-hidden rounded-2xl border bg-card",
      "transform-gpu shadow-sm transition-shadow duration-300 hover:shadow-lg",
      className
    )}
    {...props}
  >
    {background ? <div className="pointer-events-none absolute inset-0 overflow-hidden">{background}</div> : null}
    <div className="relative p-5 sm:p-6">
      <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-1.5 transition-all duration-300">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary transition-transform duration-300 ease-in-out group-hover:scale-90">
          <Icon className="size-5" />
        </span>
        <h3 className="mt-2 text-lg font-semibold text-foreground">
          {name}
        </h3>
        <p className="max-w-lg text-base leading-6 font-semibold text-foreground">{description}</p>
        {children}
      </div>

      {href && cta ? (
        <div className="pointer-events-none mt-4 flex w-full translate-y-1 transform-gpu flex-row items-center opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <Button variant="link" size="sm" className="pointer-events-auto p-0" render={<a href={href} />} nativeButton={false}>{cta}<ArrowRightIcon className="ms-2 h-4 w-4 rtl:rotate-180" /></Button>
        </div>
      ) : null}
    </div>
  </div>
)

export { BentoCard, BentoGrid }
