import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";

export const authGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(["/login"]);
    return false;
  }

  const requiredRole = route.data["role"];
  if (requiredRole && authService.getRole() !== requiredRole) {
    router.navigate(["/login"]);
    return false;
  }

  return true;
};