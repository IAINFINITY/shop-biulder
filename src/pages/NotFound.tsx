import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_18%_8%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_30%),radial-gradient(circle_at_82%_18%,color-mix(in_oklch,var(--primary)_5%,transparent),transparent_28%),radial-gradient(circle_at_55%_42%,color-mix(in_oklch,var(--primary)_3%,transparent),transparent_25%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--background))_50%,hsl(var(--muted)/0.10)_100%)]">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
