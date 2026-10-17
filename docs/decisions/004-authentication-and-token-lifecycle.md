# 4. Authentication and Token Lifecycle

## Status
Accepted

## Context
Flowsy is a mobile-first application. Mobile clients operate under intermittent connectivity, background suspensions, and secure on-device keychain/keystore storage. The authentication system must safeguard user financial data, prevent brute force attacks, avoid indefinite session risks, and support secure logout/revocation.

## Decision
1. **Password Hashing:**
   Use **Argon2id** (or `bcrypt` with appropriate work factor if native bindings dictate, with Argon2id as preferred standard) for hashing user passwords with cryptographic salts. Plaintext passwords are never stored or logged.
2. **Token Strategy:**
   - **Access Token:** Short-lived JWT (15 minutes), containing minimal claims (`sub` = user ID, `email`, `role`).
   - **Refresh Token:** Long-lived cryptographically secure random token (7 days), stored in the database in hashed form (`SHA-256` hash of the token).
3. **Token Rotation & Replay Detection:**
   - Every refresh operation issues a new Access Token AND a new rotated Refresh Token.
   - If an already-used or revoked refresh token is presented, all refresh tokens for that user session family are invalidated immediately (replay attack mitigation).
4. **Logout:**
   - `POST /api/v1/auth/logout` deletes or marks the active refresh token record as revoked in the database.
5. **Authorization:**
   - Global or route-level `JwtAuthGuard` extracts and verifies bearer tokens.
   - Resource-level checks guarantee that users cannot read, mutate, or delete resources belonging to another `userId`.

## Alternatives Considered
- **Stateless Long-Lived JWTs without DB session:**
  - *Rejected:* Cannot be revoked on logout or compromise; unacceptable for financial applications.
- **Stateful Server-Side Cookie Sessions:**
  - *Rejected:* Cookies are primarily suited for web browsers, introducing CSRF overhead and friction for native iOS/Android mobile clients.

## Consequences & Evolution Path
- Requires a `RefreshToken` entity in PostgreSQL.
- Provides secure mobile session resilience with immediate revocation capabilities.
