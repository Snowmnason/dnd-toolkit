# QA Test Guides — Quick Start

Welcome! This folder contains step-by-step testing guides written for QA testers (non-developers).

## For QA Testers: Start Here

1. **Read [README.md](./README.md)** – Overview and how to use these guides
2. **Find your platform:**
   - **App** (Desktop/Mobile): See `App/` folder
   - **Web**: See `Web/` folder
   - **Both** (Works on both): See `Both/` folder
3. **Pick a guide** and follow the test cases
4. **Record results** – Screenshots + checkboxes

## For Developers: How to Create Guides

1. **Read [MAINTAINING_TEST_GUIDES.md](./MAINTAINING_TEST_GUIDES.md)** – Rules and examples
2. **Use [TEMPLATE.md](./TEMPLATE.md)** as your starting point
3. **Reference existing guides** for best practices:
   - `App/auth-signin.md` – Complete authentication guide
   - `App/offline-access.md` – Offline testing
   - `Both/premiumfeatures-featureflags.md` – Premium features
   - `Web/navigation.md` – Web-specific behavior

## File Structure

```
docs/A Testing Guide/
├── README.md                           ← Start here (for QA)
├── QUICKSTART.md                       ← You are here
├── TEMPLATE.md                         ← Guide template for devs
├── MAINTAINING_TEST_GUIDES.md          ← Guide creation rules (for devs)
│
├── App/                                ← Desktop (Electron) & Mobile
│   ├── auth-signin.md                  ✅ Complete
│   └── offline-access.md               ✅ Complete
│
├── Both/                               ← Works on Web & App
│   └── premiumfeatures-featureflags.md ✅ Complete
│
├── Web/                                ← Web browser only
│   └── navigation.md                   ✅ Complete
│
└── legacy/                             ← Old test docs (archive)
    ├── offline_code_audit.md
    └── TESTING_GUIDE_OFFLINE_FOUNDATION.md
```

## What's Been Improved

✅ **Clear for Non-Developers**
- No code, no console commands required
- Simple, user-friendly language
- Every test explains why it matters

✅ **Complete & Comprehensive**
- Positive test cases (happy path)
- Negative test cases (error handling)
- Edge cases and platform-specific notes
- Troubleshooting guide included

✅ **Easy to Follow**
- Step-by-step instructions
- Clear expected outcomes
- How to record Pass/Fail
- Screenshot guidance

✅ **Well-Organized**
- Separated by platform (App/Web/Both)
- Consistent format across all guides
- Related tests grouped together
- Success criteria clearly stated

## Quick Stats

| Item | Count |
|------|-------|
| Test guides | 4 |
| Total lines | 1,460 |
| Test cases | 20+ |
| Supported platforms | 3 (App, Web, Both) |

## Common Questions

**Q: I'm QA. What do I do?**
A: Read README.md, pick a guide for your platform, and follow the test cases.

**Q: I'm a developer. How do I add a guide?**
A: Read MAINTAINING_TEST_GUIDES.md and use TEMPLATE.md as your starting point.

**Q: My test failed. What do I do?**
A: Take a screenshot, check the "Troubleshooting" section, and ask the developer.

**Q: A guide is unclear or out of date.**
A: Report it! Tell the developer which test confused you and why.

---

**Want to learn more?** See [README.md](./README.md) for the complete guide.
