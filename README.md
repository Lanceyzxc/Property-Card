# UCN ProCard System Documentation

The UCN ProCard System creates, stores, searches, and prints government property cards and inventory tags.

Choose the guide that matches your role:

- [User Guide](docs/USER-GUIDE.md): instructions for office staff and non-technical users.
- [Developer Guide](docs/DEVELOPER-GUIDE.md): setup, architecture, Firestore data, deployment, and maintenance.

## At A Glance

- Property Cards are managed from `public/index.html`.
- Inventory Tags are managed from `public/inventory.html`.
- Records are stored in Firebase Firestore under `propertyTags`.
- Local development starts with `npm start`.
