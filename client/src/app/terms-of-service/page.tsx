import Link from 'next/link';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - SOC Training Simulator',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-400" />
            <span className="text-lg font-semibold">SOC Training Simulator</span>
          </Link>
          <Link href="/login">
            <Button size="sm">Sign In</Button>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-8">
          <h1 className="mb-2 text-3xl font-bold text-white">Terms of Service</h1>
          <p className="mb-8 text-sm text-slate-400">Last updated: February 18, 2026</p>

          <div className="space-y-6 text-slate-300 leading-relaxed">
            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">1. Acceptance of Terms</h2>
              <p>
                By accessing or using the SOC Training Simulator (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not use the Platform.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">2. Platform Description</h2>
              <p>
                The SOC Training Simulator is a cybersecurity training platform designed for Security Operations Center (SOC) analysts. It provides realistic simulated security logs, investigation scenarios, and assessment checkpoints to develop incident response skills in a controlled environment.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">3. User Accounts and Access</h2>
              <ul className="ml-6 list-disc space-y-2">
                <li>Accounts are created and managed by platform administrators.</li>
                <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
                <li>You must not share your account or allow others to access the Platform using your credentials.</li>
                <li>You must immediately notify your administrator if you suspect unauthorized access to your account.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">4. Acceptable Use</h2>
              <p className="mb-3">When using the Platform, you agree to:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Use the Platform solely for authorized cybersecurity training purposes.</li>
                <li>Not attempt to circumvent security controls, access restrictions, or scoring mechanisms.</li>
                <li>Not extract, copy, or distribute training scenarios, simulated logs, or assessment content without authorization.</li>
                <li>Not use knowledge or tools gained from the Platform to conduct unauthorized security testing against real systems.</li>
                <li>Maintain professional conduct in all discussion messages and interactions on the Platform.</li>
                <li>Not attempt to access other users&apos; accounts, scores, or training data.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">5. Training Content</h2>
              <p>
                All training scenarios, simulated logs, checkpoint questions, and educational content on the Platform are proprietary. The scenarios depict fictional security incidents for educational purposes only. Any resemblance to actual security incidents is coincidental unless explicitly stated for educational context.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">6. User Roles and Responsibilities</h2>
              <p className="mb-3">The Platform operates with three user roles:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li><strong>Administrators</strong> manage user accounts, platform settings, and have full access to all platform features.</li>
                <li><strong>Trainers</strong> create and manage training sessions, monitor trainee progress, provide hints and feedback, and generate performance reports.</li>
                <li><strong>Trainees</strong> participate in assigned training sessions, investigate simulated incidents, answer checkpoint questions, and complete assessments.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">7. Scoring and Assessment</h2>
              <p>
                Training performance is evaluated based on accuracy, investigation thoroughness, evidence collection, response quality, and reporting. Scores are calculated automatically and may be adjusted by trainers. Scores and performance data are visible to your assigned trainers and administrators.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">8. YARA Rules</h2>
              <p>
                The Platform may include functionality to write and test YARA rules as part of training exercises. YARA rules are executed in a sandboxed environment. You must not attempt to craft rules designed to exploit the Platform infrastructure or escape the sandbox.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">9. Intellectual Property</h2>
              <p>
                The Platform, including its source code, design, training content, and documentation, is protected by intellectual property rights. You are granted a limited, non-exclusive, non-transferable license to use the Platform for its intended training purposes only.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">10. Disclaimer of Warranties</h2>
              <p>
                The Platform is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, whether express or implied. We do not guarantee that the Platform will be uninterrupted, error-free, or free of vulnerabilities. Simulated scenarios are for educational purposes and may not reflect current real-world threat landscapes.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">11. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, the Platform operators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Platform, including but not limited to loss of data, unauthorized access resulting from credential misuse, or decisions made based on training content.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">12. Account Termination</h2>
              <p>
                Administrators may deactivate or remove your account at any time for violation of these terms or for any other reason. Upon account deactivation, your access to the Platform will be revoked, though your training records may be retained per organizational policy.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">13. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms of Service at any time. Changes will be reflected on this page with an updated revision date. Continued use of the Platform after changes constitutes acceptance of the revised terms.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-white">14. Contact</h2>
              <p>
                For questions about these Terms of Service, contact your organization&apos;s platform administrator.
              </p>
            </section>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-slate-500">
          <div className="mb-4 flex items-center justify-center gap-4">
            <Link href="/privacy-policy" className="hover:text-slate-300 transition-colors">
              Privacy Policy
            </Link>
            <span>&middot;</span>
            <Link href="/terms-of-service" className="text-slate-300 transition-colors">
              Terms of Service
            </Link>
            <span>&middot;</span>
            <a
              href="https://github.com/abdullaalhussein/soc-training-simulator"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              GitHub
            </a>
          </div>
          <p>&copy; {new Date().getFullYear()} SOC Training Simulator. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
