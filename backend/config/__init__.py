"""
Register PyMySQL as the MySQLdb implementation.

Django's MySQL backend expects the `MySQLdb` module (from `mysqlclient`), which needs
libmysqlclient headers to build. PyMySQL is pure Python and installs anywhere, so this
shim points Django at it. If you install `mysqlclient` instead, delete this file's body.
"""

try:
    import pymysql

    pymysql.install_as_MySQLdb()
except ModuleNotFoundError:  # pragma: no cover - only when running on sqlite
    pass
