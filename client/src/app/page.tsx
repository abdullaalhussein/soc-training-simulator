import Link from 'next/link';
import Image from 'next/image';
import {
  Shield,
  ScrollText,
  Layers,
  CheckSquare,
  MessageCircle,
  Trophy,
  BarChart3,
  UserCog,
  GraduationCap,
  Users,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    icon: ScrollText,
    title: 'Realistic Simulated Logs',
    description:
      '10 log types including Windows Event, Sysmon, EDR Alerts, Network Flow, SIEM, Firewall, Proxy, DNS, Email Gateway, and Auth Logs.',
  },
  {
    icon: Layers,
    title: 'Multi-Stage Investigations',
    description:
      'Progressive scenario stages with unlock conditions that guide trainees through realistic incident investigation workflows.',
  },
  {
    icon: CheckSquare,
    title: 'Interactive Checkpoints',
    description:
      '8 checkpoint types including multiple choice, evidence selection, incident reports, and YARA rule writing challenges.',
  },
  {
    icon: MessageCircle,
    title: 'Real-Time Collaboration',
    description:
      'Live trainer-trainee communication via Socket.io with hints, score adjustments, and guided discussions.',
  },
  {
    icon: Trophy,
    title: 'Automated Scoring',
    description:
      '5-category weighted scoring across accuracy, investigation quality, evidence collection, response actions, and reporting.',
  },
  {
    icon: BarChart3,
    title: 'PDF Reports & Analytics',
    description:
      'Export detailed attempt reports and session leaderboards for performance review and training documentation.',
  },
];

const roles = [
  {
    icon: UserCog,
    title: 'Admin',
    description:
      'Manage users, import and configure scenarios, oversee the entire platform, and maintain system settings.',
  },
  {
    icon: GraduationCap,
    title: 'Trainer',
    description:
      'Create training sessions, monitor trainee progress in real time, provide hints, adjust scores, and review performance.',
  },
  {
    icon: Users,
    title: 'Trainee',
    description:
      'Investigate realistic incidents, analyze logs, collect evidence, complete checkpoints, and build investigation skills.',
  },
];

const techStack = [
  'Next.js 15',
  'React 19',
  'Express 5',
  'Socket.io',
  'PostgreSQL',
  'Prisma',
  'Tailwind CSS',
  'TypeScript',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-400" />
            <span className="text-lg font-semibold">SOC Training Simulator</span>
          </div>
          <Link href="/login">
            <Button size="sm">Sign In</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <Badge className="mb-6 bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/10">
          Cybersecurity Training Platform
        </Badge>
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10">
          <Shield className="h-10 w-10 text-blue-400" />
        </div>
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Train Your SOC Team with{' '}
          <span className="text-blue-400">Realistic Scenarios</span>
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg text-slate-400">
          A multi-role Security Operations Center training platform with realistic simulated logs,
          interactive checkpoints, and real-time collaboration for hands-on cybersecurity education.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/login">
            <Button size="lg">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <a href="#features">
            <Button variant="outline" size="lg" className="border-slate-600 text-white hover:bg-slate-700/50">
              Learn More
            </Button>
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold">Platform Features</h2>
          <p className="text-slate-400">Everything you need to train effective SOC analysts</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-slate-700 bg-slate-800/50 p-6"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <feature.icon className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Screenshots */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold">See It in Action</h2>
          <p className="text-slate-400">A look at the key interfaces across roles</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { label: 'Trainee Dashboard', src: '/screenshots/trainee-workspace.png' },
            { label: 'Trainer Session Console', src: '/screenshots/trainer-dashboard.png' },
            { label: 'Admin Scenario Management', src: '/screenshots/admin-management.png' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-slate-700 bg-slate-800/50 p-4"
            >
              <div className="overflow-hidden rounded-md">
                <Image
                  src={item.src}
                  alt={item.label}
                  width={1440}
                  height={900}
                  className="w-full h-auto"
                />
              </div>
              <p className="mt-3 text-center text-sm font-medium text-slate-300">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 text-center">
          <h2 className="mb-3 text-3xl font-bold">Built With</h2>
          <p className="text-slate-400">Modern, production-ready technologies</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {techStack.map((tech) => (
            <Badge
              key={tech}
              variant="secondary"
              className="px-4 py-1.5 text-sm"
            >
              {tech}
            </Badge>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold">Three Distinct Roles</h2>
          <p className="text-slate-400">Each role has a tailored experience</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {roles.map((role) => (
            <div
              key={role.title}
              className="rounded-lg border border-slate-700 bg-slate-800/50 p-6 text-center"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                <role.icon className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{role.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{role.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-10 text-center">
          <h2 className="mb-3 text-2xl font-bold">Ready to Start Training?</h2>
          <p className="mb-6 text-slate-400">
            Sign in to access scenarios, investigate incidents, and sharpen your SOC skills.
          </p>
          <Link href="/login">
            <Button size="lg">
              Sign In
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
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
            <Link href="/terms-of-service" className="hover:text-slate-300 transition-colors">
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
