# Staging Hosting Options

Reviewed: July 19, 2026

## Recommended: Railway

- One project can contain the React frontend, Node/Express backend, MySQL service, and a persistent private upload volume.
- Railway supplies HTTPS domains, environment-secret configuration, private service networking, MySQL templates, persistent volumes, and volume backup schedules.
- The current single-backend-instance requirement aligns with a volume attached to one backend service.
- Current published pricing uses a $5/month Hobby minimum that counts toward usage. CPU, memory, egress, volume storage, and backup usage can increase the bill beyond that minimum.
- Main tradeoff: usage is variable, and volume-backed services must remain deliberately single-instance for this release.

Official references:

- https://docs.railway.com/pricing
- https://docs.railway.com/guides/express
- https://docs.railway.com/guides/react
- https://docs.railway.com/volumes
- https://docs.railway.com/volumes/backups
- https://docs.railway.com/cli/deploy

## Alternative: DigitalOcean Droplet

- A single Linux VM can run the frontend, backend, MySQL, private uploads, HTTPS proxy, and scheduled reminder command with predictable resources.
- Current Basic Droplet pricing lists 1 GiB at $6/month and 2 GiB at $12/month. The 2 GiB option is safer for Node plus MySQL and OCR workloads. Optional backups add cost.
- Main tradeoff: operating-system patching, MySQL administration, firewalling, HTTPS proxy maintenance, monitoring, and recovery become our responsibility.

Official references:

- https://www.digitalocean.com/pricing/droplets
- https://docs.digitalocean.com/products/droplets/details/pricing/
- https://docs.digitalocean.com/products/databases/mysql/details/pricing/

## Recommendation

Use Railway for staging. It minimizes server administration while directly supporting the project's required Node, MySQL, HTTPS, secrets, and persistent-volume model. Start with exactly one backend instance, `MULTI_INSTANCE=false`, `RATE_LIMIT_STORE=memory`, reminders disabled in the web process, and an external one-shot reminder schedule only after email verification.
