"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  User,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  Lock,
  Phone,
  Mail,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  updateAccountProfileAction,
  changeAccountPasswordAction,
} from "@/modules/account/actions";
import type { UserAccountDTO } from "@/modules/account/service";
import { useI18n, LOCALES, LOCALE_INFOS } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AccountSettingsForm({ user }: { user: UserAccountDTO }) {
  const { locale, setLocale, t, isRtl } = useI18n();
  const [isProfilePending, startProfileTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();

  // Profile form state
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone);

  // Password visibility
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Password inputs for live strength check
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const handleProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startProfileTransition(async () => {
      const res = await updateAccountProfileAction(null, formData);
      if (res.ok && res.message) {
        toast.success(res.message);
      } else if (!res.ok && res.error) {
        toast.error(res.error);
      }
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startPasswordTransition(async () => {
      const res = await changeAccountPasswordAction(null, formData);
      if (res.ok && res.message) {
        toast.success(res.message);
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      } else if (!res.ok && res.error) {
        toast.error(res.error);
      }
    });
  };

  const hasLength = newPw.length >= 8;
  const hasUpper = /[A-Z]/.test(newPw);
  const hasLower = /[a-z]/.test(newPw);
  const hasNumber = /[0-9]/.test(newPw);
  const matchesConfirm = newPw.length > 0 && newPw === confirmPw;

  return (
    <div className="space-y-6">
      {/* ── Section : Préférences Linguistiques ── */}
      <Card className="border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{t("account.languageTitle")}</CardTitle>
              <CardDescription>{t("account.languageSubtitle")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("account.languageNotice")}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {LOCALES.map((loc) => {
              const info = LOCALE_INFOS[loc];
              const isSelected = locale === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    setLocale(loc);
                    toast.success(t("account.languageSavedSuccess"));
                  }}
                  className={cn(
                    "flex items-center justify-between p-3.5 rounded-xl border transition-all text-start cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs font-semibold"
                      : "border-border hover:border-primary/50 hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" role="img" aria-hidden="true">
                      {info.flag}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-foreground">
                        {info.nativeLabel}
                      </div>
                      <div className="text-xs text-muted-foreground font-normal">
                        {info.label} ({info.dir.toUpperCase()})
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Section 1 : Informations personnelles ── */}
        <Card className="border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{t("account.personalInfoTitle")}</CardTitle>
                <CardDescription>{t("account.personalInfoSubtitle")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="account-first-name">{t("account.firstName")}</Label>
                  <Input
                    id="account-first-name"
                    name="firstName"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={t("account.firstNamePlaceholder")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="account-last-name">{t("account.lastName")}</Label>
                  <Input
                    id="account-last-name"
                    name="lastName"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={t("account.lastNamePlaceholder")}
                  />
                </div>
              </div>

              {/* Email Address — Read-only as per strict requirements */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="account-email" className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("account.email")}
                  </Label>
                  <Badge variant="secondary" className="gap-1 text-[10px] text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" /> {t("account.emailReadonly")}
                  </Badge>
                </div>
                <Input
                  id="account-email"
                  type="email"
                  disabled
                  value={user.email}
                  className="bg-muted/50 cursor-not-allowed font-medium text-muted-foreground"
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("account.emailNotice")}
                </p>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <Label htmlFor="account-phone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("account.phone")}
                </Label>
                <Input
                  id="account-phone"
                  name="phone"
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("account.phonePlaceholder")}
                  className={cn(isRtl && "text-right")}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isProfilePending} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isProfilePending ? t("account.savingProfile") : t("account.saveProfile")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Section 2 : Sécurité & Changement de mot de passe ── */}
        <Card className="border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{t("account.securityTitle")}</CardTitle>
                <CardDescription>
                  {t("account.securitySubtitle")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {/* Current Password */}
              <div className="space-y-1.5">
                <Label htmlFor="current-pw">{t("account.currentPassword")}</Label>
                <div className="relative">
                  <Input
                    id="current-pw"
                    name="currentPassword"
                    type={showCurrent ? "text" : "password"}
                    required
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder={t("account.currentPasswordPlaceholder")}
                    className={cn(isRtl ? "pl-10" : "pr-10")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5",
                      isRtl ? "left-3" : "right-3",
                    )}
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <Label htmlFor="new-pw">{t("account.newPassword")}</Label>
                <div className="relative">
                  <Input
                    id="new-pw"
                    name="newPassword"
                    type={showNew ? "text" : "password"}
                    required
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder={t("account.newPasswordPlaceholder")}
                    className={cn(isRtl ? "pl-10" : "pr-10")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5",
                      isRtl ? "left-3" : "right-3",
                    )}
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw">{t("account.confirmPassword")}</Label>
                <div className="relative">
                  <Input
                    id="confirm-pw"
                    name="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    required
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder={t("account.confirmPasswordPlaceholder")}
                    className={cn(isRtl ? "pl-10" : "pr-10")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5",
                      isRtl ? "left-3" : "right-3",
                    )}
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Live Password Strength Criteria Checklist */}
              <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2 text-xs">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  {t("account.passwordRequirements")}
                </div>
                <ul className="space-y-1.5 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-colors",
                        hasLength ? "text-emerald-500" : "text-muted-foreground/40",
                      )}
                    />
                    <span className={cn(hasLength && "text-foreground font-medium")}>
                      {t("account.reqMinLength")}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-colors",
                        hasUpper ? "text-emerald-500" : "text-muted-foreground/40",
                      )}
                    />
                    <span className={cn(hasUpper && "text-foreground font-medium")}>
                      {t("account.reqUppercase")}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-colors",
                        hasLower ? "text-emerald-500" : "text-muted-foreground/40",
                      )}
                    />
                    <span className={cn(hasLower && "text-foreground font-medium")}>
                      {t("account.reqLowercase")}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-colors",
                        hasNumber ? "text-emerald-500" : "text-muted-foreground/40",
                      )}
                    />
                    <span className={cn(hasNumber && "text-foreground font-medium")}>
                      {t("account.reqNumber")}
                    </span>
                  </li>
                  {confirmPw.length > 0 && (
                    <li className="flex items-center gap-2 pt-1 border-t border-border/50">
                      <CheckCircle2
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 transition-colors",
                          matchesConfirm ? "text-emerald-500" : "text-red-500",
                        )}
                      />
                      <span
                        className={cn(
                          matchesConfirm
                            ? "text-foreground font-medium"
                            : "text-red-600 dark:text-red-400 font-medium",
                        )}
                      >
                        {t("account.reqMatch")}
                      </span>
                    </li>
                  )}
                </ul>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={
                    isPasswordPending ||
                    !hasLength ||
                    !hasUpper ||
                    !hasLower ||
                    !hasNumber ||
                    !matchesConfirm
                  }
                  className="gap-2"
                >
                  <Lock className="h-4 w-4" />
                  {isPasswordPending ? t("account.changingPassword") : t("account.changePassword")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
