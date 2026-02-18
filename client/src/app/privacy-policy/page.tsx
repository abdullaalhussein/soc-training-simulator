import Link from 'next/link';
import { Shield } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - SOC Training Simulator',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-3 pt-8">
          <Link href="/login" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold text-white">SOC Training Simulator</span>
          </Link>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-8">
          <h1 className="mb-2 text-3xl font-bold text-white">Privacy Policy</h1>
          <p className="mb-8 text-sm text-slate-400">Last updated: February 18, 2026</p>

          <div className="space-y-6 text-slate-300 leading-relaxed">
            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">1. Introduction</h2>
              <p>
                This Privacy Policy describes how the SOC Training Simulator (&quot;the Platform&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, and protects your personal information when you use our cybersecurity training platform.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">2. Information We Collect</h2>
              <p className="mb-3">We collect the following types of information:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li><strong>Account Information:</strong> Name, email address, and role assignment (Admin, Trainer, or Trainee) as provided by your administrator.</li>
                <li><strong>Authentication Data:</strong> Encrypted passwords, login timestamps, and session tokens.</li>
                <li><strong>Training Activity:</strong> Investigation actions, checkpoint answers, evidence selections, timeline entries, scores, and hint usage during training scenarios.</li>
                <li><strong>Audit Logs:</strong> Actions performed on the platform, IP addresses, and timestamps for security and compliance purposes.</li>
                <li><strong>Discussion Messages:</strong> Messages sent during training sessions between trainers and trainees.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">3. How We Use Your Information</h2>
              <p className="mb-3">Your information is used to:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Provide and operate the training platform.</li>
                <li>Authenticate your identity and manage access control.</li>
                <li>Track training progress, calculate scores, and generate performance reports.</li>
                <li>Enable trainers to monitor, guide, and evaluate trainee performance.</li>
                <li>Maintain audit trails for security and compliance.</li>
                <li>Improve the platform and training content.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">4. Data Storage and Security</h2>
              <p>
                All data is stored in a secured PostgreSQL database. Passwords are hashed using bcrypt with a cost factor of 12. Communication between your browser and our servers is encrypted via HTTPS/TLS. Access to data is restricted based on user roles with the principle of least privilege.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">5. Data Sharing</h2>
              <p>
                We do not sell, trade, or share your personal information with third parties. Your training data is accessible only to authorized administrators and trainers within your organization. Trainee performance data is visible to the trainers who manage the training sessions you participate in.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">6. Data Retention</h2>
              <p>
                Your account data and training records are retained for as long as your account is active. Administrators may deactivate accounts, after which data may be retained for compliance purposes as required by your organization&apos;s policies.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">7. Your Rights</h2>
              <p className="mb-3">Depending on your jurisdiction, you may have the right to:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Access the personal data we hold about you.</li>
                <li>Request correction of inaccurate data.</li>
                <li>Request deletion of your account and associated data.</li>
                <li>Export your training records.</li>
              </ul>
              <p className="mt-3">To exercise these rights, contact your platform administrator.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">8. Cookies and Local Storage</h2>
              <p>
                The Platform uses browser local storage to maintain your authentication session. We do not use tracking cookies or third-party analytics. No data is shared with advertising networks.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">9. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. Any changes will be reflected on this page with an updated revision date. Continued use of the Platform after changes constitutes acceptance of the revised policy.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">10. Contact</h2>
              <p>
                For questions about this Privacy Policy or your data, contact your organization&apos;s platform administrator.
              </p>
            </section>
          </div>
        </div>

        <div className="mt-6 pb-8 text-center text-sm text-slate-500">
          <Link href="/terms-of-service" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
          <span className="mx-2">&middot;</span>
          <Link href="/login" className="hover:text-slate-300 transition-colors">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
