const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const VALID_LICENSE = 'TRIALVGAHUB2026';
const LICENSE_FILE_NAME = 'vgahub-license.json';

function verifyLicense(rawLicense) {
  if (typeof rawLicense !== 'string') {
    return false;
  }

  return rawLicense.trim() === VALID_LICENSE;
}

function getLicenseFilePath() {
  const appDataDir = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const targetDir = path.join(appDataDir, 'VGAHUB');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  return path.join(targetDir, LICENSE_FILE_NAME);
}

function isLicenseAccepted() {
  const licenseFilePath = getLicenseFilePath();

  if (!fs.existsSync(licenseFilePath)) {
    return false;
  }

  try {
    const raw = fs.readFileSync(licenseFilePath, 'utf8');
    const stored = JSON.parse(raw);
    return verifyLicense(stored && stored.license);
  } catch (error) {
    return false;
  }
}

function saveLicenseAccepted(license) {
  const licenseFilePath = getLicenseFilePath();
  const payload = {
    license: String(license).trim(),
    acceptedAt: new Date().toISOString()
  };

  fs.writeFileSync(licenseFilePath, JSON.stringify(payload, null, 2));
}

function promptForLicense() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Masukkan license number: ', (input) => {
      rl.close();

      const sanitizedInput = String(input || '').trim();
      if (verifyLicense(sanitizedInput)) {
        saveLicenseAccepted(sanitizedInput);
        console.log('License valid. Proses instalasi dilanjutkan.');
        resolve(true);
        return;
      }

      console.error('License tidak valid. Aplikasi tidak dapat dilanjutkan.');
      resolve(false);
    });
  });
}

async function ensureLicense() {
  if (isLicenseAccepted()) {
    return true;
  }

  const accepted = await promptForLicense();
  if (!accepted) {
    process.exit(1);
  }

  return true;
}

module.exports = {
  VALID_LICENSE,
  verifyLicense,
  isLicenseAccepted,
  saveLicenseAccepted,
  promptForLicense,
  ensureLicense
};
