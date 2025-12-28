"""Compatibility shim for Python 3.12+.

Python removed the stdlib `distutils` package in 3.12.
Some third-party packages (e.g. django-bootstrap-form / bootstrapform) still import
`distutils.version.StrictVersion`.

We provide a minimal drop-in implementation to keep the app running on newer
Python versions.
"""
