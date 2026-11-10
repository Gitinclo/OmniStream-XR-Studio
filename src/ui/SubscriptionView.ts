import {
  BillingCycle,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PLAN_ORDER,
  SubscriptionInvoiceRecord,
  SubscriptionPlanId,
  UserSubscriptionRecord,
  computeAnnualSavingsPercent,
  computeEffectiveMonthlyPriceUsd,
  computePlanPeriodPriceUsd,
  getSubscriptionPlan,
} from '../services/subscriptionEngine';

export interface SubscriptionViewProps {
  currentUserEmail: string | null;
  currentUserUid: string | null;
  isVerifiedMasterAdmin: boolean;
  subscription: UserSubscriptionRecord;
  invoices: SubscriptionInvoiceRecord[];
  selectedBillingCycle: BillingCycle;
  paymentMethodLast4: string;
  remainingDailyQuotaUnits: number;
  statusBanner: string;
  isSubmitting: boolean;
}

export interface SubscriptionViewHandlers {
  onSelectBillingCycle: (cycle: BillingCycle) => void;
  onChangePaymentLast4: (last4: string) => void;
  onCheckoutPlan: (planId: SubscriptionPlanId, cycle: BillingCycle) => void;
  onCancelSubscription: (immediate: boolean) => void;
  onDownloadInvoiceJson: (invoice: SubscriptionInvoiceRecord) => void;
}

export class SubscriptionView {
  public static render(props: SubscriptionViewProps): string {
    const activePlan = getSubscriptionPlan(props.subscription.planId);
    const totalQuota = props.subscription.dailyQuotaUnits || 250;
    const remainingQuota = Math.min(
      totalQuota,
      Math.max(0, props.remainingDailyQuotaUnits)
    );
    const usedQuota = Math.max(0, totalQuota - remainingQuota);
    const quotaPercent = Math.min(
      100,
      Math.round((usedQuota / Math.max(1, totalQuota)) * 100)
    );

    const periodEndFormatted = props.subscription.currentPeriodEndIso
      ? new Date(props.subscription.currentPeriodEndIso).toLocaleDateString(
          'en-US',
          {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }
        )
      : 'N/A';

    const statusBadgeClass =
      props.subscription.status === 'ACTIVE' &&
      !props.subscription.cancelAtPeriodEnd
        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
        : 'bg-amber-500/15 text-amber-300 border-amber-500/40';

    const statusLabel = props.subscription.cancelAtPeriodEnd
      ? 'CANCELS AT PERIOD END'
      : props.subscription.status;

    return `
      <div class="pointer-events-auto w-full h-full flex-1 bg-[#090d16] text-slate-100 p-4 md:p-6 overflow-y-auto space-y-5">
        <!-- Top Breadcrumb & Server Authority Banner -->
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div class="text-[11px] font-mono-code uppercase tracking-wider text-sky-400">
              Workspace / Plans, Billing & Server Entitlements
            </div>
            <h1 class="text-lg md:text-xl font-bold text-white mt-0.5">
              OmniStream XR Studio Subscriptions & Quota Governance
            </h1>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[11px] font-mono-code px-2.5 py-1 rounded border border-indigo-500/40 bg-indigo-500/15 text-indigo-300">
              Authority: ${props.subscription.verifiedBy}
            </span>
            <span class="text-[11px] font-mono-code px-2.5 py-1 rounded border ${
              props.subscription.isPremium
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                : 'border-slate-700 bg-slate-900 text-slate-300'
            }">
              Entitlement: ${
                props.subscription.isPremium
                  ? 'PREMIUM AD-FREE (isPremium: true)'
                  : 'STANDARD (isPremium: false)'
              }
            </span>
          </div>
        </div>

        ${
          props.statusBanner
            ? `<div id="subscription-status-banner" class="px-3.5 py-2.5 rounded-lg border border-sky-500/40 bg-sky-950/50 text-xs text-sky-200 flex items-center justify-between gap-2">
                 <span>${props.statusBanner}</span>
                 <span class="text-[11px] font-mono-code text-sky-400 shrink-0">${
                   props.currentUserEmail || 'Guest Sandbox'
                 }</span>
               </div>`
            : ''
        }

        <!-- Active Subscription Summary Bar -->
        <section aria-label="Active subscription summary" class="bg-[#0e1424] border border-slate-800 rounded-xl p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div class="lg:col-span-5 space-y-1.5">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-mono-code uppercase text-slate-400">Active Plan:</span>
              <span id="sub-active-plan-name" class="text-base font-bold text-white">${activePlan.name}</span>
              <span class="text-[10px] font-mono-code px-2 py-0.5 rounded border ${statusBadgeClass}">
                ${statusLabel}
              </span>
            </div>
            <p class="text-xs text-slate-300">
              ${activePlan.tagline}
            </p>
            <div class="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono-code text-slate-400">
              <span>Max Stream: <strong class="text-sky-300">${props.subscription.maxStreamResolution}</strong></span>
              <span>•</span>
              <span>Cadence: <strong class="text-slate-200">${props.subscription.billingCycle}</strong></span>
              <span>•</span>
              <span>Renews/Ends: <strong class="text-slate-200">${periodEndFormatted}</strong></span>
              <span>•</span>
              <span>Card: <strong class="text-slate-200">${
                props.subscription.paymentMethodLast4 === 'NONE'
                  ? 'No Card ($0)'
                  : `Visa •••• ${props.subscription.paymentMethodLast4}`
              }</strong></span>
            </div>
          </div>

          <!-- Daily AI Quota Meter -->
          <div class="lg:col-span-4 bg-slate-950/90 border border-slate-800/90 rounded-lg p-3 space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="font-semibold text-slate-300">Daily Gemini Studio Quota</span>
              <span id="sub-quota-readout" class="font-mono-code text-sky-300">
                ${remainingQuota} / ${totalQuota} units remaining
              </span>
            </div>
            <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                class="h-full bg-sky-400 transition-all duration-300"
                style="width: ${Math.max(4, 100 - quotaPercent)}%"
              ></div>
            </div>
            <div class="flex items-center justify-between text-[11px] font-mono-code text-slate-400">
              <span>Used today: ${usedQuota} units</span>
              <span>Resets 00:00 UTC</span>
            </div>
          </div>

          <!-- Quick Subscription Lifecycle Actions -->
          <div class="lg:col-span-3 flex flex-col sm:flex-row lg:flex-col gap-2 justify-end">
            ${
              props.subscription.planId !== 'FREE_STANDARD' &&
              props.subscription.billingCycle === 'MONTHLY'
                ? `<button
                     type="button"
                     id="btn-sub-switch-annual"
                     class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer"
                   >
                     Switch to Annual (Save 20%)
                   </button>`
                : ''
            }
            ${
              props.subscription.planId !== 'FREE_STANDARD' &&
              !props.subscription.cancelAtPeriodEnd
                ? `<button
                     type="button"
                     id="btn-sub-cancel-period-end"
                     class="px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                   >
                     Cancel at Period End
                   </button>`
                : ''
            }
            ${
              props.subscription.cancelAtPeriodEnd
                ? `<button
                     type="button"
                     id="btn-sub-reactivate"
                     class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer"
                   >
                     Resume Active Subscription
                   </button>`
                : ''
            }
            ${
              props.subscription.planId !== 'FREE_STANDARD'
                ? `<button
                     type="button"
                     id="btn-sub-downgrade-free"
                     class="px-3 py-1 text-[11px] font-mono-code rounded border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 cursor-pointer"
                   >
                     Immediate Downgrade to Free ($0)
                   </button>`
                : `<div class="text-[11px] font-mono-code text-slate-400 text-center lg:text-right">
                     Upgrade below to unlock 8K/32K & Ad-Free Studio
                   </div>`
            }
          </div>
        </section>

        <!-- Billing Cycle Switcher & Payment Method Configuration Bar -->
        <section aria-label="Billing cycle and payment controls" class="flex flex-wrap items-center justify-between gap-3 bg-[#0e1424] border border-slate-800 rounded-xl px-4 py-3">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-semibold text-slate-300">Billing Cycle:</span>
            <div class="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-0.5">
              <button
                type="button"
                id="btn-cycle-monthly"
                data-cycle="MONTHLY"
                class="px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                  props.selectedBillingCycle === 'MONTHLY'
                    ? 'bg-[#3a4bff] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }"
              >
                Monthly Billing
              </button>
              <button
                type="button"
                id="btn-cycle-annual"
                data-cycle="ANNUAL"
                class="px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                  props.selectedBillingCycle === 'ANNUAL'
                    ? 'bg-[#3a4bff] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }"
              >
                <span>Annual Billing</span>
                <span class="text-[10px] font-mono-code px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <label for="input-payment-last4" class="text-xs text-slate-300 font-mono-code">
               Express Checkout Card (Last 4):
            </label>
            <input
              id="input-payment-last4"
              type="text"
              maxlength="4"
              value="${props.paymentMethodLast4}"
              placeholder="4242"
              class="w-20 bg-slate-950 text-xs font-mono-code text-sky-300 px-2.5 py-1 rounded border border-slate-700 text-center"
            />
          </div>
        </section>

        <!-- 3-Tier Plan Comparison Matrix -->
        <section aria-label="Subscription plan comparison" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${SUBSCRIPTION_PLAN_ORDER.map((planId) => {
            const plan = SUBSCRIPTION_PLANS[planId];
            const isCurrentPlan =
              props.subscription.planId === plan.id &&
              !props.subscription.cancelAtPeriodEnd;
            const isCurrentPlanAndCycle =
              isCurrentPlan &&
              props.subscription.billingCycle === props.selectedBillingCycle;

            const effectiveMonthlyUsd = computeEffectiveMonthlyPriceUsd(
              plan.id,
              props.selectedBillingCycle
            );
            const periodTotalUsd = computePlanPeriodPriceUsd(
              plan.id,
              props.selectedBillingCycle
            );
            const savingsPct = computeAnnualSavingsPercent(plan.id);

            const borderClass = isCurrentPlan
              ? 'border-sky-500 bg-[#101932]'
              : plan.id === 'PRO_8K_CREATOR'
              ? 'border-indigo-500/60 bg-[#0e1424]'
              : 'border-slate-800 bg-[#0e1424]';

            let buttonLabel = `Subscribe to ${plan.name}`;
            if (isCurrentPlanAndCycle) {
              buttonLabel = 'Current Active Plan';
            } else if (isCurrentPlan) {
              buttonLabel = `Switch ${plan.name} to ${props.selectedBillingCycle}`;
            } else if (plan.id === 'FREE_STANDARD') {
              buttonLabel = 'Switch to Standard Free ($0)';
            } else {
              buttonLabel = `Upgrade to ${plan.name}`;
            }

            return `
              <div class="rounded-xl border ${borderClass} p-4 flex flex-col justify-between gap-4">
                <div class="space-y-3">
                  <div class="flex items-center justify-between gap-2">
                    <h2 class="text-base font-bold text-white">${plan.name}</h2>
                    ${
                      isCurrentPlan
                        ? `<span class="text-[10px] font-mono-code px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">CURRENT PLAN</span>`
                        : plan.badge
                        ? `<span class="text-[10px] font-mono-code px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">${plan.badge}</span>`
                        : ''
                    }
                  </div>
                  <p class="text-xs text-slate-400">${plan.targetAudience}</p>

                  <!-- Tabular Price Display -->
                  <div class="pt-1 pb-2 border-b border-slate-800">
                    <div class="flex items-baseline gap-1.5 font-mono-code">
                      <span class="text-2xl md:text-3xl font-bold text-white">$${effectiveMonthlyUsd}</span>
                      <span class="text-xs text-slate-400">/ month</span>
                    </div>
                    <div class="text-[11px] font-mono-code text-slate-400 mt-1">
                      ${
                        plan.monthlyPriceUsd === 0
                          ? 'Free forever • Server-enforced standard limits'
                          : props.selectedBillingCycle === 'ANNUAL'
                          ? `Billed annually at $${periodTotalUsd}/yr (Save ${savingsPct}%)`
                          : `Billed monthly at $${periodTotalUsd}/mo (or $${plan.annualMonthlyEquivalentUsd}/mo annually)`
                      }
                    </div>
                  </div>

                  <!-- Concrete Technical Limits Row -->
                  <div class="grid grid-cols-3 gap-1.5 text-center bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 font-mono-code">
                    <div>
                      <div class="text-[10px] text-slate-400">STREAM</div>
                      <div class="text-xs font-bold text-sky-300">${plan.maxStreamResolution}</div>
                    </div>
                    <div>
                      <div class="text-[10px] text-slate-400">AI QUOTA</div>
                      <div class="text-xs font-bold text-emerald-300">${plan.dailyQuotaUnits}/day</div>
                    </div>
                    <div>
                      <div class="text-[10px] text-slate-400">VAULT</div>
                      <div class="text-xs font-bold text-indigo-300">${plan.vaultCapacityKb} KB</div>
                    </div>
                  </div>

                  <!-- Feature List -->
                  <ul class="space-y-1.5 text-xs text-slate-300 pt-1">
                    ${plan.features
                      .map(
                        (feat) => `
                      <li class="flex items-start gap-2">
                        <span class="text-emerald-400 font-bold shrink-0">✓</span>
                        <span>${feat}</span>
                      </li>`
                      )
                      .join('')}
                  </ul>
                </div>

                <button
                  type="button"
                  data-checkout-plan="${plan.id}"
                  ${isCurrentPlanAndCycle || props.isSubmitting ? 'disabled' : ''}
                  class="btn-checkout-plan w-full py-2 px-3 text-xs font-bold rounded-lg transition cursor-pointer ${
                    isCurrentPlanAndCycle
                      ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-default'
                      : plan.id === 'STUDIO_32K_ENTERPRISE'
                      ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                      : plan.id === 'PRO_8K_CREATOR'
                      ? 'bg-[#3a4bff] text-white hover:bg-indigo-500'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  }"
                >
                  ${buttonLabel}
                </button>
              </div>
            `;
          }).join('')}
        </section>

        <!-- Billing & Invoice History Ledger -->
        <section aria-label="Invoice history ledger" class="bg-[#0e1424] border border-slate-800 rounded-xl p-4 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="text-sm font-bold text-white">Server Billing & Invoice Ledger</h2>
              <p class="text-xs text-slate-400">
                Cryptographically timestamped receipts generated by the Server Subscription Authority (<code class="text-sky-300">/api/subscriptions/checkout</code>).
              </p>
            </div>
            <span class="text-xs font-mono-code text-slate-400">
              Total Invoices: ${props.invoices.length}
            </span>
          </div>

          ${
            props.invoices.length === 0
              ? `<div class="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
                   <span>No paid or plan-change invoices recorded in this session yet. Select a plan above to generate an instant receipt.</span>
                   <span class="font-mono-code text-slate-500">Status: Nominal ($0.00 billed)</span>
                 </div>`
              : `<div class="overflow-x-auto">
                   <table class="w-full text-left border-collapse text-xs">
                     <thead>
                       <tr class="border-b border-slate-800 text-[11px] font-mono-code uppercase text-slate-400">
                         <th class="py-2 pr-3">Invoice ID</th>
                         <th class="py-2 px-3">Date (UTC)</th>
                         <th class="py-2 px-3">Plan & Cycle</th>
                         <th class="py-2 px-3">Payment Method</th>
                         <th class="py-2 px-3">Status</th>
                         <th class="py-2 px-3 text-right">Amount (USD)</th>
                         <th class="py-2 pl-3 text-right">Receipt</th>
                       </tr>
                     </thead>
                     <tbody class="divide-y divide-slate-800/70 font-mono-code">
                       ${props.invoices
                         .map(
                           (inv) => `
                         <tr class="hover:bg-slate-900/60">
                           <td class="py-2.5 pr-3 text-sky-300">${inv.invoiceId}</td>
                           <td class="py-2.5 px-3 text-slate-300">${inv.issuedAtIso.slice(0, 19).replace('T', ' ')}</td>
                           <td class="py-2.5 px-3 text-white font-sans font-medium">${inv.planName} <span class="text-[11px] font-mono-code text-slate-400">(${inv.billingCycle})</span></td>
                           <td class="py-2.5 px-3 text-slate-300">${inv.paymentMethodSummary}</td>
                           <td class="py-2.5 px-3">
                             <span class="px-2 py-0.5 rounded text-[10px] ${
                               inv.status === 'PAID'
                                 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                 : 'bg-slate-800 text-slate-300'
                             }">${inv.status}</span>
                           </td>
                           <td class="py-2.5 px-3 text-right font-bold text-white">$${inv.amountUsd.toFixed(2)}</td>
                           <td class="py-2.5 pl-3 text-right">
                             <button
                               type="button"
                               data-invoice-id="${inv.invoiceId}"
                               class="btn-download-invoice px-2 py-1 text-[11px] rounded bg-slate-800 text-sky-300 hover:bg-slate-700 border border-slate-700 cursor-pointer"
                             >
                               Download JSON
                             </button>
                           </td>
                         </tr>`
                         )
                         .join('')}
                     </tbody>
                   </table>
                 </div>`
          }
        </section>
      </div>
    `;
  }

  public static bindEvents(
    props: SubscriptionViewProps,
    handlers: SubscriptionViewHandlers
  ): void {
    document
      .getElementById('btn-cycle-monthly')
      ?.addEventListener('click', () => {
        handlers.onSelectBillingCycle('MONTHLY');
      });

    document
      .getElementById('btn-cycle-annual')
      ?.addEventListener('click', () => {
        handlers.onSelectBillingCycle('ANNUAL');
      });

    const last4Input = document.getElementById(
      'input-payment-last4'
    ) as HTMLInputElement | null;
    last4Input?.addEventListener('change', () => {
      handlers.onChangePaymentLast4(last4Input.value);
    });

    document.querySelectorAll('.btn-checkout-plan').forEach((btn) => {
      btn.addEventListener('click', () => {
        const planId = (btn as HTMLElement).dataset
          .checkoutPlan as SubscriptionPlanId;
        if (planId) {
          handlers.onCheckoutPlan(planId, props.selectedBillingCycle);
        }
      });
    });

    document
      .getElementById('btn-sub-switch-annual')
      ?.addEventListener('click', () => {
        handlers.onCheckoutPlan(props.subscription.planId, 'ANNUAL');
      });

    document
      .getElementById('btn-sub-cancel-period-end')
      ?.addEventListener('click', () => {
        handlers.onCancelSubscription(false);
      });

    document
      .getElementById('btn-sub-reactivate')
      ?.addEventListener('click', () => {
        handlers.onCheckoutPlan(
          props.subscription.planId,
          props.subscription.billingCycle
        );
      });

    document
      .getElementById('btn-sub-downgrade-free')
      ?.addEventListener('click', () => {
        handlers.onCancelSubscription(true);
      });

    document.querySelectorAll('.btn-download-invoice').forEach((btn) => {
      btn.addEventListener('click', () => {
        const invId = (btn as HTMLElement).dataset.invoiceId;
        const found = props.invoices.find((i) => i.invoiceId === invId);
        if (found) {
          handlers.onDownloadInvoiceJson(found);
        }
      });
    });
  }
}
