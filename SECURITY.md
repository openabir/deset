# Security Policy

## Supported Versions

We support the following versions with security updates:

| Version | Supported        |
| ------- | ---------------- |
| 1.x.x   | ✅ Full support  |
| < 1.0   | ❌ Not supported |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

1. **Do not** open a public GitHub issue
2. Email us at: abirxbiswas69@gmail.com
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

## Security Response Process

1. **Acknowledgment**: We'll acknowledge receipt within 24 hours
2. **Investigation**: We'll investigate and assess the vulnerability within 72 hours
3. **Resolution**: We'll work on a fix and coordinate disclosure timing
4. **Disclosure**: Once fixed, we'll publicly disclose the vulnerability

## Security Best Practices

When using @oas/deset:

- Always run with the latest version
- Review configuration changes before applying
- Use `--dry-run` flag when testing in production environments
- Keep your Node.js and npm versions updated
- Use npm audit regularly to check for vulnerabilities

## Security Features

@oas/deset includes several security features:

- **npm audit integration**: Automatically checks for known vulnerabilities
- **Package validation**: Verifies package integrity during updates
- **Safe defaults**: Conservative configuration settings
- **Input validation**: All user inputs are validated and sanitized
- **No arbitrary code execution**: Commands are explicitly defined and validated

## Contact

For security-related questions or concerns:

- Email: abirxbiswas69@gmail.com
- GitHub: [@openabir](https://github.com/openabir)
