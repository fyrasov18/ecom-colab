export type AuthLang = "fr" | "ar" | "en";

export interface AuthDictionary {
  dir: "ltr" | "rtl";
  langName: string;
  login: {
    title: string;
    subtitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    showPassword: string;
    hidePassword: string;
    submitButton: string;
    submitting: string;
    newPartner: string;
    createAccount: string;
    pendingAlertTitle: string;
    pendingAlertText: string;
    invalidCredentialsError: string;
    devAccountsTitle: string;
    devAccountsSubtitle: string;
  };
  register: {
    title: string;
    subtitle: string;
    approvalNoticeTitle: string;
    approvalNoticeText: string;
    personalInfoLegend: string;
    fullNameLabel: string;
    fullNamePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    securityLegend: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    confirmPasswordLabel: string;
    confirmPasswordPlaceholder: string;
    partnerInfoLegend: string;
    inviteCodeLabel: string;
    inviteCodePlaceholder: string;
    experienceLabel: string;
    experiencePlaceholder: string;
    experienceDebutant: string;
    experienceIntermediaire: string;
    experienceExpert: string;
    termsLabel: string;
    submitButton: string;
    submitting: string;
    alreadyRegistered: string;
    loginLink: string;
    successTitle: string;
    successPendingTitle: string;
    successPendingText: string;
    backToLogin: string;
  };
  hero: {
    loginBadge: string;
    loginTitle: string;
    loginSubtitle: string;
    loginPoints: [string, string, string];
    registerBadge: string;
    registerTitle: string;
    registerSubtitle: string;
    registerPoints: [string, string, string];
  };
}

export const AUTH_DICTIONARY: Record<AuthLang, AuthDictionary> = {
  fr: {
    dir: "ltr",
    langName: "Français",
    login: {
      title: "Connexion",
      subtitle: "Connectez-vous pour accéder à votre espace de gestion.",
      emailLabel: "Adresse e-mail",
      emailPlaceholder: "votre@email.tn",
      passwordLabel: "Mot de passe",
      passwordPlaceholder: "Votre mot de passe",
      showPassword: "Afficher le mot de passe",
      hidePassword: "Masquer le mot de passe",
      submitButton: "Se connecter",
      submitting: "Connexion en cours…",
      newPartner: "Nouveau partenaire ?",
      createAccount: "Créer un compte",
      pendingAlertTitle: "Compte en attente",
      pendingAlertText:
        "Votre compte partenaire est en attente de validation par l'administrateur.",
      invalidCredentialsError:
        "Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.",
      devAccountsTitle: "Comptes de test",
      devAccountsSubtitle: "Cliquez pour pré-remplir les identifiants",
    },
    register: {
      title: "Créer un compte partenaire",
      subtitle:
        "Inscrivez-vous pour rejoindre le réseau et accéder à votre espace de vente.",
      approvalNoticeTitle: "Validation requise",
      approvalNoticeText:
        "Votre compte sera activé par un administrateur après vérification.",
      personalInfoLegend: "Informations personnelles",
      fullNameLabel: "Nom complet",
      fullNamePlaceholder: "Ex. Sami Bouazizi",
      emailLabel: "Adresse e-mail",
      emailPlaceholder: "sami@exemple.tn",
      phoneLabel: "Téléphone (8 chiffres)",
      phonePlaceholder: "22 333 444",
      securityLegend: "Sécurité du compte",
      passwordLabel: "Mot de passe",
      passwordPlaceholder: "8 caractères minimum",
      confirmPasswordLabel: "Confirmer le mot de passe",
      confirmPasswordPlaceholder: "Répétez le mot de passe",
      partnerInfoLegend: "Informations partenaire",
      inviteCodeLabel: "Code d'invitation",
      inviteCodePlaceholder: "Code fourni par votre contact",
      experienceLabel: "Expérience e-commerce",
      experiencePlaceholder: "Choisir…",
      experienceDebutant: "Débutant",
      experienceIntermediaire: "Intermédiaire",
      experienceExpert: "Expert",
      termsLabel: "J'accepte les conditions d'utilisation de la plateforme.",
      submitButton: "Créer mon compte partenaire",
      submitting: "Création en cours…",
      alreadyRegistered: "Déjà inscrit ?",
      loginLink: "Se connecter",
      successTitle: "Compte créé avec succès",
      successPendingTitle: "Validation en attente",
      successPendingText:
        "Votre demande est enregistrée et sera validée par l'administrateur. Vous pourrez vous connecter dès son activation.",
      backToLogin: "Retour à la connexion",
    },
    hero: {
      loginBadge: "Espace Sécurisé",
      loginTitle: "Espace Partenaire & Administration",
      loginSubtitle:
        "Accédez à votre tableau de bord pour piloter vos commandes, consulter le catalogue et suivre vos commissions.",
      loginPoints: [
        "Gestion des commandes et suivi des statuts de livraison",
        "Consultation du catalogue et des produits assignés",
        "Suivi du portefeuille et des demandes de retrait",
      ],
      registerBadge: "Réseau Partenaire",
      registerTitle: "Rejoindre le Réseau Partenaire",
      registerSubtitle:
        "Inscrivez-vous pour collaborer avec la plateforme et accéder à votre espace de vente dédié.",
      registerPoints: [
        "Accès au catalogue des produits pour vos ventes",
        "Programme de parrainage et attribution de commissions",
        "Validation de chaque compte par l'administration",
      ],
    },
  },
  ar: {
    dir: "rtl",
    langName: "العربية",
    login: {
      title: "تسجيل الدخول",
      subtitle: "سجّل الدخول للوصول إلى لوحة التحكم الخاصة بك.",
      emailLabel: "البريد الإلكتروني",
      emailPlaceholder: "votre@email.tn",
      passwordLabel: "كلمة المرور",
      passwordPlaceholder: "كلمة المرور الخاصة بك",
      showPassword: "إظهار كلمة المرور",
      hidePassword: "إخفاء كلمة المرور",
      submitButton: "تسجيل الدخول",
      submitting: "جاري تسجيل الدخول…",
      newPartner: "شريك جديد؟",
      createAccount: "إنشاء حساب",
      pendingAlertTitle: "الحساب قيد المراجعة",
      pendingAlertText:
        "حساب الشريك الخاص بك قيد انتظار التأكيد من قبل إدارة المنصة.",
      invalidCredentialsError:
        "بيانات الدخول غير صحيحة. يرجى التحقق من البريد وكلمة المرور.",
      devAccountsTitle: "حسابات تجريبية",
      devAccountsSubtitle: "انقر للتعبئة التلقائية للبيانات",
    },
    register: {
      title: "إنشاء حساب شريك",
      subtitle:
        "سجّل الآن للانضمام إلى شبكة الشركاء والوصول إلى فضاء البيع الخاص بك.",
      approvalNoticeTitle: "تأكيد الحساب مطلوب",
      approvalNoticeText:
        "سيتم تفعيل حسابك من قِبل مسؤول النظام بعد التحقق من البيانات.",
      personalInfoLegend: "المعلومات الشخصية",
      fullNameLabel: "الاسم الكامل",
      fullNamePlaceholder: "مثال: سامي بوعزيزي",
      emailLabel: "البريد الإلكتروني",
      emailPlaceholder: "sami@exemple.tn",
      phoneLabel: "رقم الهاتف (8 أرقام)",
      phonePlaceholder: "22 333 444",
      securityLegend: "أمان الحساب",
      passwordLabel: "كلمة المرور",
      passwordPlaceholder: "8 أحرف على الأقل",
      confirmPasswordLabel: "تأكيد كلمة المرور",
      confirmPasswordPlaceholder: "أعد كتابة كلمة المرور",
      partnerInfoLegend: "معلومات الشريك",
      inviteCodeLabel: "رمز الدعوة",
      inviteCodePlaceholder: "الرمز المقدم من جهة الاتصال",
      experienceLabel: "الخبرة في التجارة الإلكترونية",
      experiencePlaceholder: "اختر…",
      experienceDebutant: "مبتدئ",
      experienceIntermediaire: "متوسط",
      experienceExpert: "خبير",
      termsLabel: "أوافق على شروط استخدام المنصة.",
      submitButton: "إنشاء حساب الشريك",
      submitting: "جاري إنشاء الحساب…",
      alreadyRegistered: "لديك حساب بالفعل؟",
      loginLink: "تسجيل الدخول",
      successTitle: "تم إنشاء الحساب بنجاح",
      successPendingTitle: "في انتظار التفعيل",
      successPendingText:
        "تم تسجيل طلبك بنجاح وسيقوم المسؤول بمراجعته وتفعيله قريباً. ستتمكن من تسجيل الدخول فور التفعيل.",
      backToLogin: "العودة إلى تسجيل الدخول",
    },
    hero: {
      loginBadge: "فضاء آمن",
      loginTitle: "فضاء الشركاء والإدارة",
      loginSubtitle:
        "لوحة تحكم مركزية لإدارة ومتابعة طلبياتك، تصفح المنتجات ومتابعة رصيد العمولات.",
      loginPoints: [
        "إدارة الطلبيات ومتابعة مسار حالات التوصيل",
        "تصفح كتالوج المنتجات والسلع المتاحة",
        "متابعة رصيد المحفظة وطلبات السحب المالي",
      ],
      registerBadge: "شبكة الشركاء",
      registerTitle: "الانضمام إلى شبكة الشركاء",
      registerSubtitle:
        "أنشئ حسابك للتعاون مع المنصة والوصول إلى أدوات ومنتجات التجارة الإلكترونية.",
      registerPoints: [
        "الوصول إلى كتالوج المنتجات لبدء عمليات البيع",
        "برنامج الإحالة واحتساب العمولات المستحقة",
        "مراجعة وتفعيل الحسابات يدوياً من طرف الإدارة",
      ],
    },
  },
  en: {
    dir: "ltr",
    langName: "English",
    login: {
      title: "Sign In",
      subtitle: "Sign in to access your management dashboard.",
      emailLabel: "Email address",
      emailPlaceholder: "your@email.com",
      passwordLabel: "Password",
      passwordPlaceholder: "Your password",
      showPassword: "Show password",
      hidePassword: "Hide password",
      submitButton: "Sign in",
      submitting: "Signing in…",
      newPartner: "New partner?",
      createAccount: "Create an account",
      pendingAlertTitle: "Account Pending",
      pendingAlertText:
        "Your partner account is pending administrator validation.",
      invalidCredentialsError:
        "Invalid credentials. Please verify your email and password.",
      devAccountsTitle: "Test accounts",
      devAccountsSubtitle: "Click to quick-fill credentials",
    },
    register: {
      title: "Create Partner Account",
      subtitle:
        "Sign up to join the partner network and access your dedicated sales workspace.",
      approvalNoticeTitle: "Approval Required",
      approvalNoticeText:
        "Your account will be activated by an administrator after review.",
      personalInfoLegend: "Personal Information",
      fullNameLabel: "Full name",
      fullNamePlaceholder: "e.g. Sami Bouazizi",
      emailLabel: "Email address",
      emailPlaceholder: "sami@example.com",
      phoneLabel: "Phone number (8 digits)",
      phonePlaceholder: "22 333 444",
      securityLegend: "Account Security",
      passwordLabel: "Password",
      passwordPlaceholder: "Minimum 8 characters",
      confirmPasswordLabel: "Confirm password",
      confirmPasswordPlaceholder: "Repeat password",
      partnerInfoLegend: "Partner Information",
      inviteCodeLabel: "Invitation code",
      inviteCodePlaceholder: "Code provided by your contact",
      experienceLabel: "E-commerce experience",
      experiencePlaceholder: "Select…",
      experienceDebutant: "Beginner",
      experienceIntermediaire: "Intermediate",
      experienceExpert: "Expert",
      termsLabel: "I agree to the platform terms of service.",
      submitButton: "Create my partner account",
      submitting: "Creating account…",
      alreadyRegistered: "Already registered?",
      loginLink: "Sign in",
      successTitle: "Account Created Successfully",
      successPendingTitle: "Validation Pending",
      successPendingText:
        "Your registration is recorded and will be verified by an administrator. You will be able to sign in once activated.",
      backToLogin: "Back to Sign In",
    },
    hero: {
      loginBadge: "Secure Access",
      loginTitle: "Partner & Admin Workspace",
      loginSubtitle:
        "Access your centralized dashboard to manage customer orders, browse the catalogue, and track your commissions.",
      loginPoints: [
        "Order management and delivery status tracking",
        "Product catalogue browsing and assigned items",
        "Wallet balance tracking and withdrawal requests",
      ],
      registerBadge: "Partner Network",
      registerTitle: "Join the Partner Network",
      registerSubtitle:
        "Sign up to collaborate with the platform and access your dedicated sales workspace.",
      registerPoints: [
        "Access to product catalogue for your sales activity",
        "Referral attribution and commission tracking",
        "Account approval process verified by administrators",
      ],
    },
  },
};
