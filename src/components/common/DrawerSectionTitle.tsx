import { cn } from "@/lib/utils";

interface DrawerSectionTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export default function DrawerSectionTitle({ className, children, ...props }: DrawerSectionTitleProps) {
  return (
    <h3 
      className={cn(
        "text-base font-bold text-gray-900 border-l-4 border-blue-600 pl-3 mb-3",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}
