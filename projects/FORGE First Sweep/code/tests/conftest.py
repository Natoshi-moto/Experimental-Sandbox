from __future__ import annotations

import socket

import pytest


def _network_denied(*_args: object, **_kwargs: object) -> None:
    raise AssertionError("outbound network is disabled for the FORGE test suite")


@pytest.fixture(autouse=True)
def deny_outbound_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fail every test that attempts Python-level DNS or socket connection."""

    monkeypatch.setattr(socket, "create_connection", _network_denied)
    monkeypatch.setattr(socket, "getaddrinfo", _network_denied)
    monkeypatch.setattr(socket.socket, "connect", _network_denied)
    monkeypatch.setattr(socket.socket, "connect_ex", _network_denied)
