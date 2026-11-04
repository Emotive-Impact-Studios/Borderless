# Launchers and service example

`launch.sh`, `Borderless.command` and `launch.cmd` start the same Node hub. They install locked production dependencies if missing; initial installation needs npm access. They do not create accounts, certificates, firewall rules, virtual displays or a network share. Node 24 LTS must already be installed.

For a managed Linux host, review `borderless.service` and replace paths/hostname/user for that installation. Use a non-privileged dedicated service user and TLS key readable only by that service. The example is not installed automatically. Follow docs/OPERATIONS.md before binding to the LAN.

After an unclean failure, `hub.lock` deliberately prevents a second writer. Confirm the original process has stopped before removing the stale lock. A service manager restart may require that operator recovery until the lock-recovery work package is hardened.
