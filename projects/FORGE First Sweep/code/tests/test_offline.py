from __future__ import annotations

import socket

import pytest


def test_offline_guard_blocks_dns_and_socket_connections() -> None:
    with pytest.raises(AssertionError, match="network is disabled"):
        socket.getaddrinfo("example.com", 443)
    with pytest.raises(AssertionError, match="network is disabled"):
        socket.create_connection(("example.com", 443))
