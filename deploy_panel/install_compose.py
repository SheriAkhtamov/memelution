#!/usr/bin/env python3
"""Install docker compose v2 on remote server."""
import sys; sys.path.insert(0, '.')
from app import load_config, get_server, get_ssh_client, ssh_exec

cfg = load_config()
server, _ = get_server(cfg)
client = get_ssh_client(server)

print("Installing docker compose v2...")
code, out, err = ssh_exec(client, 'apt-get update -qq && apt-get install -y -qq docker-compose-v2 2>&1 && echo INSTALL_OK || echo FAIL', timeout=120)
print(out[:500])
if "INSTALL_OK" in out:
    code2, out2, _ = ssh_exec(client, 'docker compose version 2>&1', timeout=10)
    print("docker compose version:", out2.strip())
else:
    # install compose plugin manually
    print("Package approach failed, trying docker compose plugin...")
    code, out, err = ssh_exec(client, "DOCKER_CONFIG=/usr/libexec/docker && mkdir -p $DOCKER_CONFIG/cli-plugins && curl -sSL https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o $DOCKER_CONFIG/cli-plugins/docker-compose && chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose && echo PLUGIN_OK", timeout=120)
    print(out[:500])
    if "PLUGIN_OK" in out:
        code2, out2, _ = ssh_exec(client, 'docker compose version', timeout=10)
        print("docker compose version:", out2.strip())

client.close()
