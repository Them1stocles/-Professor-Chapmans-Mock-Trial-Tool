/**
 * Student List Parser
 * Parses various formats of student lists and extracts name/email pairs
 */

export interface ParsedStudent {
  name: string;
  email: string;
}

export interface ParseResult {
  students: ParsedStudent[];
  errors: Array<{
    line: string;
    error: string;
  }>;
  duplicates: string[];
}

/**
 * Validates email format using RFC 5322 compliant regex
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

/**
 * Normalizes whitespace and removes extra characters
 */
function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/[""]/g, '"')  // Normalize quotes
    .replace(/['']/g, "'")  // Normalize apostrophes
    .trim();
}

/**
 * Parses student list in format: "Name (email), Name (email), ..."
 * Also supports:
 * - Newline separated
 * - Semicolon separated
 * - Tab separated
 * - Mixed formats
 */
export function parseStudentList(input: string): ParseResult {
  const students: ParsedStudent[] = [];
  const errors: Array<{ line: string; error: string }> = [];
  const seenEmails = new Set<string>();
  const duplicates: string[] = [];

  if (!input || !input.trim()) {
    return { students: [], errors: [], duplicates: [] };
  }

  // Normalize the input
  const normalized = normalizeText(input);

  // Pattern to match: Name (email) or email alone
  // Supports: "First Last (email@domain.com)" or just "email@domain.com"
  const patterns = [
    // Pattern 1: Name (email)
    /([^(,;\n\t]+?)\s*\(([^)]+)\)/g,
    // Pattern 2: Just email addresses
    /\b([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)\b/g
  ];

  // Try pattern 1 first (Name (email))
  const nameEmailPattern = patterns[0];
  let match;
  let foundAny = false;

  while ((match = nameEmailPattern.exec(normalized)) !== null) {
    foundAny = true;
    let name = match[1].trim();
    const email = match[2].trim().toLowerCase();

    // Clean up name (remove trailing commas, semicolons, etc.)
    name = name.replace(/[,;]+$/, '').trim();

    // Validate email
    if (!isValidEmail(email)) {
      errors.push({
        line: `${name} (${email})`,
        error: 'Invalid email format'
      });
      continue;
    }

    // Check for duplicates within this paste
    if (seenEmails.has(email)) {
      duplicates.push(email);
      continue;
    }

    seenEmails.add(email);
    students.push({ name, email });
  }

  // If no matches found with pattern 1, try pattern 2 (just emails)
  if (!foundAny) {
    const emailOnlyPattern = patterns[1];
    while ((match = emailOnlyPattern.exec(normalized)) !== null) {
      const email = match[1].trim().toLowerCase();

      if (!isValidEmail(email)) {
        continue;
      }

      if (seenEmails.has(email)) {
        duplicates.push(email);
        continue;
      }

      seenEmails.add(email);
      // Use email username as name if no name provided
      const username = email.split('@')[0];
      const name = username.charAt(0).toUpperCase() + username.slice(1);
      students.push({ name, email });
    }
  }

  return {
    students,
    errors,
    duplicates
  };
}

/**
 * Validates a batch of students against existing database records
 */
export interface ValidationResult {
  valid: ParsedStudent[];
  existing: string[];
  invalid: Array<{ student: ParsedStudent; reason: string }>;
}

export function validateStudents(
  parsed: ParsedStudent[],
  existingEmails: Set<string>
): ValidationResult {
  const valid: ParsedStudent[] = [];
  const existing: string[] = [];
  const invalid: Array<{ student: ParsedStudent; reason: string }> = [];

  for (const student of parsed) {
    // Check if already exists in database
    if (existingEmails.has(student.email.toLowerCase())) {
      existing.push(student.email);
      continue;
    }

    // Validate name
    if (!student.name || student.name.length < 2) {
      invalid.push({
        student,
        reason: 'Name too short (minimum 2 characters)'
      });
      continue;
    }

    if (student.name.length > 100) {
      invalid.push({
        student,
        reason: 'Name too long (maximum 100 characters)'
      });
      continue;
    }

    // Validate email length
    if (student.email.length > 255) {
      invalid.push({
        student,
        reason: 'Email too long (maximum 255 characters)'
      });
      continue;
    }

    valid.push(student);
  }

  return { valid, existing, invalid };
}
