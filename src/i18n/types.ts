export type Locale = 'de' | 'en';

export interface TranslationDictionary {
  // Common / shared
  common: {
    noCategory: string;
    noProject: string;
    income: string;
    incomePlural: string;
    expense: string;
    expensePlural: string;
    total: string;
    all: string;
    active: string;
    inactive: string;
    draft: string;
    sent: string;
    paid: string;
    monthly: string;
    quarterly: string;
    yearly: string;
    weekly: string;
    profit: string;
    loss: string;
    healthy: string;
    neutral: string;
    critical: string;
    allPeriod: string;
  };

  // Transaction tool descriptions + messages
  transactions: {
    addIncomeDesc: string;
    addIncomeProjectHint: string;
    amountDesc: string;
    descriptionDesc: string;
    incomeDescriptionDesc: string;
    expenseDescriptionDesc: string;
    incomeCategoryDesc: string;
    expenseCategoryDesc: string;
    dateDesc: string;
    projectDesc: string;
    addExpenseDesc: string;
    listDesc: string;
    typeDesc: string;
    fromDateDesc: string;
    toDateDesc: string;
    categoryFilterDesc: string;
    projectFilterDesc: string;
    limitDesc: string;
    deleteDesc: string;
    idDesc: string;
    updateDesc: string;
    newAmountDesc: string;
    newDescriptionDesc: string;
    newCategoryDesc: string;
    newDateDesc: string;
    updateProjectDesc: string;
    incomeSaved: string;
    expenseSaved: string;
    newCategoryCreated: string;
    newProjectCreated: string;
    projectLimitSkipped: string;
    notFound: string;
    deleted: string;
    updated: string;
    noChanges: string;
    changeAmount: string;
    changeDescription: string;
    changeDate: string;
    changeCategory: string;
    changeCategoryCreated: string;
    changeProject: string;
  };

  // Summary tool descriptions + messages
  summary: {
    getSummaryDesc: string;
    periodDesc: string;
    dateRefDesc: string;
    categoryBreakdownDesc: string;
    typeDesc: string;
    comparePeriodDesc: string;
    periodTypeDesc: string;
    currentDateDesc: string;
    compareDateDesc: string;
    taxSummaryDesc: string;
    yearDesc: string;
    quarterDesc: string;
    taxProOnly: string;
    taxHint: string;
    exportTip: string;
  };

  // Budget tool descriptions + messages
  budget: {
    setDesc: string;
    amountDesc: string;
    periodDesc: string;
    categoryDesc: string;
    nameDesc: string;
    alertDesc: string;
    statusDesc: string;
    statusCategoryDesc: string;
    listDesc: string;
    deleteDesc: string;
    deleteIdDesc: string;
    updateDesc: string;
    updateIdDesc: string;
    updateAmountDesc: string;
    updateAlertDesc: string;
    updateActiveDesc: string;
    categoryNotFound: string;
    budgetUpdated: string;
    limitReached: string;
    budgetCreated: string;
    noBudgets: string;
    noBudgetsList: string;
    budgetNotFound: string;
    budgetDeleted: string;
    budgetUpdatedMsg: string;
    noChanges: string;
    changeAmount: string;
    changeThreshold: string;
    changeStatus: string;
    totalBudget: string;
    overBudget: string;
    warningBudget: string;
    allGood: string;
    budgetExceeded: string;
    budgetWarning: string;
  };

  // Invoice tool descriptions + messages
  invoice: {
    createDesc: string;
    clientNameDesc: string;
    clientAddressDesc: string;
    itemsDesc: string;
    itemDescriptionDesc: string;
    itemAmountDesc: string;
    itemQuantityDesc: string;
    invoiceDateDesc: string;
    dueDateDesc: string;
    notesDesc: string;
    listDesc: string;
    statusFilterDesc: string;
    listLimitDesc: string;
    getDesc: string;
    getIdDesc: string;
    markSentDesc: string;
    markSentIdDesc: string;
    markPaidDesc: string;
    markPaidIdDesc: string;
    duplicateDesc: string;
    duplicateIdDesc: string;
    duplicateDateDesc: string;
    duplicateDueDateDesc: string;
    noProfile: string;
    created: string;
    notFound: string;
    markedSent: string;
    markedPaid: string;
    invoiceIdRequired: string;
    originalNotFound: string;
    duplicated: string;
    statusDraft: string;
    statusSent: string;
    statusPaid: string;
    proOnly: string;
  };

  // Export tool descriptions + messages
  export: {
    transactionsDesc: string;
    formatDesc: string;
    fromDateDesc: string;
    toDateDesc: string;
    invoicesDesc: string;
    invoiceStatusDesc: string;
    taxAdvisorDesc: string;
    taxYearDesc: string;
    taxQuarterDesc: string;
    taxFormatDesc: string;
    taxKontenrahmenDesc: string;
    noTransactions: string;
    transactionsExported: string;
    noInvoices: string;
    invoicesExported: string;
    taxProOnly: string;
    noTransactionsForPeriod: string;
    taxExportCreated: string;
    proOnly: string;
  };

  // Connection tool descriptions + messages
  connection: {
    connectDesc: string;
    statusDesc: string;
    disconnectDesc: string;
    syncStatusDesc: string;
    syncNowDesc: string;
    syncFullDesc: string;
    alreadyConnected: string;
    linkError: string;
    linkCreated: string;
    instruction1: string;
    instruction2: string;
    instruction3: string;
    linkHint: string;
    apiError: string;
    apiErrorHint: string;
    connected: string;
    connectionSuccess: string;
    syncHint: string;
    linkExpired: string;
    linkExpiredHint: string;
    pendingLink: string;
    pendingLinkHint: string;
    notConnected: string;
    notConnectedHint: string;
    featureRealtime: string;
    featureDashboard: string;
    featureExport: string;
    featureCharts: string;
    featurePdfCsv: string;
    featureMultiDevice: string;
    featureBackup: string;
    notConnectedShort: string;
    disconnected: string;
    disconnectedNote: string;
    disconnectedHint: string;
    syncNotConnected: string;
    syncNotConnectedHint: string;
    allSynced: string;
    pendingEntries: string;
    syncErrors: string;
    syncErrorHint: string;
    syncNotConnectedShort: string;
    syncNotConnectedShortHint: string;
    fullSyncErrors: string;
    fullSyncDone: string;
    nothingToSync: string;
    syncedEntries: string;
    syncedWithErrors: string;
    connectionHint: string;
    connectionHintSummary: string;
    proOnly: string;
  };

  // Category tool descriptions + messages
  categories: {
    listDesc: string;
    typeFilterDesc: string;
    addDesc: string;
    addNameDesc: string;
    addTypeDesc: string;
    deleteDesc: string;
    deleteIdDesc: string;
    alreadyExists: string;
    created: string;
    notFound: string;
    cannotDeleteDefault: string;
    noPermission: string;
    inUse: string;
    deleted: string;
  };

  // Project tool descriptions + messages
  projects: {
    listDesc: string;
    statusFilterDesc: string;
    renameDesc: string;
    projectNameDesc: string;
    newNameDesc: string;
    createDesc: string;
    createNameDesc: string;
    createDescriptionDesc: string;
    createBudgetDesc: string;
    deleteDesc: string;
    deleteProjectDesc: string;
    nameRequired: string;
    projectNotFound: string;
    renamed: string;
    projectNameRequired: string;
    limitReached: string;
    alreadyExists: string;
    created: string;
    deleted: string;
  };

  // Recurring tool descriptions + messages
  recurring: {
    createDesc: string;
    typeDesc: string;
    amountDesc: string;
    descriptionDesc: string;
    categoryDesc: string;
    intervalDesc: string;
    startDateDesc: string;
    endDateDesc: string;
    listDesc: string;
    activeOnlyDesc: string;
    deleteDesc: string;
    deleteIdDesc: string;
    processDesc: string;
    created: string;
    notFound: string;
    deleted: string;
    nothingDue: string;
    processed: string;
    limitReached: string;
  };

  // Profile tool descriptions + messages
  profile: {
    getDesc: string;
    setDesc: string;
    companyNameDesc: string;
    addressDesc: string;
    taxIdDesc: string;
    kleinunternehmerDesc: string;
    bankDetailsDesc: string;
    phoneDesc: string;
    emailDesc: string;
    noProfile: string;
    saved: string;
    kleinunternehmerHint: string;
  };

  // Notification tool descriptions + messages
  notifications: {
    getDesc: string;
    daysAheadDesc: string;
    noConnection: string;
    recurringDue: string;
    recurringDueToday: string;
    recurringDueDays: string;
    invoiceOverdue: string;
    invoiceOverdueMsg: string;
    budgetAlert: string;
    budgetAlertMsg: string;
    taxReminder: string;
    taxReminderMsg: string;
    noNotifications: string;
    summaryCount: string;
    summaryCountImportant: string;
  };

  // Freemium messages
  freemium: Record<string, never>;

  // Intervals
  intervals: {
    weekly: string;
    monthly: string;
    quarterly: string;
    yearly: string;
  };

  // Zod validation
  validation: {
    nameRequired: string;
    invalidCategoryId: string;
  };

  // CLI strings (npx spendlog)
  cli: {
    // Database
    dbInitialized: string;
    dbError: string;

    // No data
    noDataYet: string;
    noDataStartWith: string;
    noDataOrSay: string;
    noDataExample: string;

    // Install flow
    settingUp: string;
    installed: string;
    installedFor: string;
    claudeCodeCli: string;
    claudeDesktopApp: string;
    sayInClaude: string;
    examplePrompt: string;
    dataLocation: string;
    readyToGo: string;
    restartDesktop: string;
    restartDesktopHint: string;
    claudeCodeReady: string;
    noClaudeDetected: string;
    settingProject: string;

    // Status
    installStatus: string;
    dataSection: string;
    databaseFound: string;
    databaseNotCreated: string;
    dataDirNotCreated: string;

    // Quick summary
    incomeLabel: string;
    expensesLabel: string;
    netLabel: string;
    topExpenses: string;
    hintMore: string;
    hintMoreExample: string;

    // Export
    exportSuccess: string;
    exportPeriod: string;
    exportTransactions: string;
    exportIncome: string;
    exportExpenses: string;
    exportFile: string;

    // Year/period labels
    yearLabel: string;

    // Uninstall
    removing: string;
    dataKept: string;
    dataDeleteHint: string;
  };
}
