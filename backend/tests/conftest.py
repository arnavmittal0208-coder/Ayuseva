import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import app.database
from app.database import Base

TEST_DB_PATH = "test_health_platform.db"

# Force test engine and SessionLocal before any test modules are run
if os.path.exists(TEST_DB_PATH):
    try:
        os.remove(TEST_DB_PATH)
    except:
        pass

test_engine = create_engine(f"sqlite:///{TEST_DB_PATH}", connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Override database variables
app.database.engine = test_engine
app.database.SessionLocal = TestSessionLocal

# Setup schema
Base.metadata.create_all(bind=test_engine)

# Apply column additions
from app.main import check_and_add_columns
check_and_add_columns()

@pytest.fixture(scope="session", autouse=True)
def cleanup_test_db():
    yield
    # Dispose of engine connection pool to release file lock on Windows
    test_engine.dispose()
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except Exception as e:
            print(f"[TEST TEARDOWN] Could not remove test database: {e}")
